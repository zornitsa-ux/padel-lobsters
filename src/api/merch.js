import { supabase } from '../supabase'

export async function loadMerchItems() {
  // Try ordering by display_order first; fall back to id if column doesn't exist yet
  let { data, error } = await supabase
    .from('merch_items')
    .select('*')
    .eq('active', true)
    .order('display_order')
    .order('id')
  if (error) {
    const res = await supabase.from('merch_items').select('*').eq('active', true).order('id')
    data = res.data
  }
  return data || []
}

export async function loadMerchInterests() {
  // Always use simple select to avoid join issues
  const { data, error } = await supabase.from('merch_interests').select('*')
  if (error) {
    console.error('loadInterests failed:', error.message)
    return []
  }
  return data || []
}

export async function loadRecentMerchInterests(since, limit = 20) {
  const { data } = await supabase
    .from('merch_interests')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

export async function loadActiveMerchItemNames() {
  const { data } = await supabase.from('merch_items').select('id, name').eq('active', true)
  return data || []
}

// Upsert a merch item (insert when no id, update otherwise). Mirrors the
// admin save flow with graceful fallbacks for the legacy schemas where
// external_orders / display_order columns may not exist yet.
export async function upsertMerchItem(payload, editItem, currentItems) {
  if (editItem) {
    // Graceful fallback: if the external_orders column doesn't exist yet
    // (e.g. v15 migration not run), retry without it so admin can still
    // edit the rest of the item.
    let res = await supabase.from('merch_items').update(payload).eq('id', editItem.id)
    if (res.error) {
      const { external_orders: _drop, ...rest } = payload
      await supabase.from('merch_items').update(rest).eq('id', editItem.id)
    }
  } else {
    // New items go to the end of the list
    const maxOrder =
      currentItems.length > 0 ? Math.max(...currentItems.map((i) => i.display_order || 0)) : 0
    let res = await supabase.from('merch_items').insert({ ...payload, display_order: maxOrder + 1 })
    if (res.error) {
      const { external_orders: _drop, ...rest } = payload
      res = await supabase.from('merch_items').insert({ ...rest, display_order: maxOrder + 1 })
    }
    if (res.error) await supabase.from('merch_items').insert(payload)
  }
}

export async function deleteMerchItem(id) {
  await supabase.from('merch_items').update({ active: false }).eq('id', id)
}

export async function reorderMerchItems(reordered) {
  const updates = reordered.map((item, i) =>
    supabase.from('merch_items').update({ display_order: i }).eq('id', item.id),
  )
  await Promise.all(updates)
}

export async function findExistingInterest(playerId, itemId) {
  const { data } = await supabase
    .from('merch_interests')
    .select('id')
    .eq('player_id', playerId)
    .eq('merch_item_id', itemId)
    .limit(1)
  return data || []
}

// Insert a new merch interest row, with progressive fallbacks for the
// older schemas (status / custom_name columns may not exist yet).
export async function createMerchInterest(base, name) {
  let res = await supabase
    .from('merch_interests')
    .insert({ ...base, status: 'ordered', custom_name: name || '' })
  if (res.error) {
    res = await supabase.from('merch_interests').insert({ ...base, status: 'ordered' })
  }
  if (res.error) {
    res = await supabase.from('merch_interests').insert({ ...base, custom_name: name || '' })
  }
  if (res.error) {
    res = await supabase.from('merch_interests').insert(base)
  }
  return res
}

export async function updateMerchInterest(id, data) {
  let res = await supabase.from('merch_interests').update(data).eq('id', id)
  if (res.error && data.custom_name !== undefined) {
    const { custom_name: _drop, ...rest } = data
    res = await supabase.from('merch_interests').update(rest).eq('id', id)
  }
  return res
}

export async function cancelMerchInterest(id, comment) {
  const { error } = await supabase
    .from('merch_interests')
    .update({
      status: 'cancelled',
      admin_comment: comment || null,
      cancelled_at: new Date().toISOString(),
      paid: false,
      delivered: false,
    })
    .eq('id', id)
  if (error) {
    // Fallback: try without status fields (pre-v12)
    await supabase
      .from('merch_interests')
      .update({
        paid: false,
        delivered: false,
      })
      .eq('id', id)
  }
}

export async function markMerchInterestPaid(id) {
  await supabase.from('merch_interests').update({ status: 'paid', paid: true }).eq('id', id)
}

export async function markMerchInterestDelivered(id) {
  await supabase
    .from('merch_interests')
    .update({ status: 'delivered', delivered: true })
    .eq('id', id)
}

export async function uploadMerchImage(file) {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/\s/g, '_')}`
  const { error: uploadError } = await supabase.storage
    .from('merch')
    .upload(filename, file, { upsert: true })
  if (uploadError) throw uploadError
  const {
    data: { publicUrl },
  } = supabase.storage.from('merch').getPublicUrl(filename)
  return publicUrl
}
