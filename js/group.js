// Groepsfunctionaliteit: groep aanmaken/joinen en de gedeelde tussenstand.
// Werkt bovenop Supabase (config in js/supabase-config.js). Zonder geldige
// config blijft de app gewoon solo werken (zie app.js).

const Group = (() => {
  const MEMBERSHIP_KEY = 'schorle-group';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // geen 0/O/1/I, voorkomt verwarring

  let client = null;
  let membership = loadMembership();
  let myEntries = []; // ms timestamps, cache
  let standings = [];
  let channel = null;
  let changeListeners = [];

  function isConfigured() {
    return typeof window.SCHORLE_SUPABASE_URL === 'string' &&
      window.SCHORLE_SUPABASE_URL.length > 0 &&
      typeof window.SCHORLE_SUPABASE_ANON_KEY === 'string' &&
      window.SCHORLE_SUPABASE_ANON_KEY.length > 0;
  }

  function getClient() {
    if (!client && isConfigured() && window.supabase) {
      client = window.supabase.createClient(window.SCHORLE_SUPABASE_URL, window.SCHORLE_SUPABASE_ANON_KEY);
    }
    return client;
  }

  function loadMembership() {
    try {
      const raw = localStorage.getItem(MEMBERSHIP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveMembership(m) {
    membership = m;
    if (m) {
      localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify(m));
    } else {
      localStorage.removeItem(MEMBERSHIP_KEY);
    }
  }

  function isActive() {
    return isConfigured() && !!membership;
  }

  function randomCode(length = 5) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  }

  function onChange(cb) {
    changeListeners.push(cb);
  }

  function notifyChange() {
    changeListeners.forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  async function create(groupName, memberName) {
    const supabase = getClient();
    if (!supabase) throw new Error(I18n.t('errorGroupsNotConfigured'));

    let group = null;
    let lastError = null;
    for (let attempt = 0; attempt < 5 && !group; attempt++) {
      const code = randomCode();
      const { data, error } = await supabase
        .from('groups')
        .insert({ code, name: groupName })
        .select()
        .single();
      if (!error) {
        group = data;
      } else if (error.code === '23505') {
        lastError = error; // code bestond al, probeer opnieuw
      } else {
        throw error;
      }
    }
    if (!group) throw lastError || new Error(I18n.t('errorNoUniqueCode'));

    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({ group_id: group.id, name: memberName })
      .select()
      .single();
    if (memberError) throw memberError;

    saveMembership({
      groupId: group.id,
      memberId: member.id,
      name: memberName,
      code: group.code,
      groupName: group.name,
    });
    myEntries = [];
    await refresh();
    subscribeRealtime();
    return membership;
  }

  async function join(code, memberName) {
    const supabase = getClient();
    if (!supabase) throw new Error(I18n.t('errorGroupsNotConfigured'));

    const normalizedCode = code.trim().toUpperCase();
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select()
      .eq('code', normalizedCode)
      .maybeSingle();
    if (groupError) throw groupError;
    if (!group) throw new Error(I18n.t('errorNoGroupCode'));

    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({ group_id: group.id, name: memberName })
      .select()
      .single();
    if (memberError) throw memberError;

    saveMembership({
      groupId: group.id,
      memberId: member.id,
      name: memberName,
      code: group.code,
      groupName: group.name,
    });
    myEntries = [];
    await refresh();
    subscribeRealtime();
    return membership;
  }

  function leave() {
    unsubscribeRealtime();
    saveMembership(null);
    myEntries = [];
    standings = [];
  }

  function getMembership() {
    return membership;
  }

  function getMyEntries() {
    return myEntries;
  }

  function getStandings() {
    return standings;
  }

  async function fetchMyEntries() {
    const supabase = getClient();
    if (!supabase || !membership) return;
    const { data, error } = await supabase
      .from('entries')
      .select('created_at')
      .eq('member_id', membership.memberId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    myEntries = (data || []).map(row => new Date(row.created_at).getTime());
  }

  async function fetchStandings() {
    const supabase = getClient();
    if (!supabase || !membership) return;
    const { data, error } = await supabase
      .from('group_standings')
      .select('*')
      .eq('group_id', membership.groupId)
      .order('count', { ascending: false });
    if (error) throw error;
    standings = (data || []).map(row => ({
      memberId: row.member_id,
      name: row.name,
      count: row.count,
      isMe: row.member_id === membership.memberId,
    }));
  }

  async function refresh() {
    await Promise.all([fetchMyEntries(), fetchStandings()]);
  }

  async function addEntry() {
    const supabase = getClient();
    if (!supabase || !membership) throw new Error('Niet in een groep.');
    const { error } = await supabase
      .from('entries')
      .insert({ group_id: membership.groupId, member_id: membership.memberId });
    if (error) throw error;
    await refresh();
  }

  async function removeLast() {
    const supabase = getClient();
    if (!supabase || !membership || myEntries.length === 0) return;
    const { data, error } = await supabase
      .from('entries')
      .select('id')
      .eq('member_id', membership.memberId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    if (data && data[0]) {
      const { error: delError } = await supabase.from('entries').delete().eq('id', data[0].id);
      if (delError) throw delError;
    }
    await refresh();
  }

  async function resetAll() {
    const supabase = getClient();
    if (!supabase || !membership) return;
    const { error } = await supabase.from('entries').delete().eq('member_id', membership.memberId);
    if (error) throw error;
    await refresh();
  }

  function subscribeRealtime() {
    const supabase = getClient();
    if (!supabase || !membership) return;
    unsubscribeRealtime();
    channel = supabase
      .channel(`group-${membership.groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `group_id=eq.${membership.groupId}` },
        () => { refresh().then(notifyChange); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `group_id=eq.${membership.groupId}` },
        () => { refresh().then(notifyChange); })
      .subscribe();
  }

  function unsubscribeRealtime() {
    if (channel) {
      const supabase = getClient();
      if (supabase) supabase.removeChannel(channel);
      channel = null;
    }
  }

  async function init() {
    if (isActive()) {
      subscribeRealtime();
      try {
        await refresh();
      } catch (e) {
        console.error('Kon groepsgegevens niet laden', e);
      }
    }
  }

  return {
    isConfigured,
    isActive,
    create,
    join,
    leave,
    getMembership,
    getMyEntries,
    getStandings,
    addEntry,
    removeLast,
    resetAll,
    refresh,
    onChange,
    init,
  };
})();
