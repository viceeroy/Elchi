import { getSupabaseAdmin } from './supabase-admin.ts';

export async function provisionTelegramUser(payload: {
  id: number;
  username?: string;
  first_name?: string;
  photo_url?: string;
}): Promise<{ hashed_token: string }> {
  const supabaseAdmin = getSupabaseAdmin();
  const syntheticEmail = `telegram_${payload.id}@elchi.local`;

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: syntheticEmail,
    email_confirm: true,
    user_metadata: {
      telegram_id: payload.id,
      telegram_username: payload.username || null,
      display_name: payload.first_name || payload.username || null,
      avatar_url: payload.photo_url || null,
      provider: 'telegram',
    },
  });

  if (createError) {
    const err = createError as { status?: number; code?: string; message?: string };
    const isAlreadyExists =
      err.status === 422 ||
      err.code === 'email_exists' ||
      Boolean(err.message?.toLowerCase().includes('already'));
    if (!isAlreadyExists) {
      throw new Error(`Error creating Telegram user: ${err.message}`);
    }
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: syntheticEmail,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    throw new Error(`Error generating Telegram session link: ${linkError?.message}`);
  }

  return { hashed_token: linkData.properties.hashed_token };
}

export async function getOrCreateTelegramProfile(payload: {
  id: number;
  username?: string;
  first_name?: string;
  photo_url?: string;
}): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin();
  let { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('telegram_id', payload.id).maybeSingle();
  
  if (profile?.id) return profile.id;

  // Try creating the user to trigger the `handle_new_user` Postgres trigger
  await provisionTelegramUser(payload).catch(() => {});

  // Fetch again
  const { data: newProfile } = await supabaseAdmin.from('profiles').select('id').eq('telegram_id', payload.id).maybeSingle();
  if (!newProfile?.id) {
    throw new Error('Failed to provision Telegram profile');
  }
  return newProfile.id;
}
