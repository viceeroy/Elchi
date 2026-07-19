import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const { post_id } = req.body || {};

    if (!post_id) {
      return res.status(400).json({ error: 'Post ID ko\'rsatilmagan' });
    }

    // Verify post exists
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .select('id')
      .eq('id', post_id)
      .single();

    if (postError || !postData) {
      return res.status(404).json({ error: 'Post topilmadi' });
    }

    const { error: reportError } = await supabase
      .from('reports')
      .insert([{ post_id }]);

    if (reportError) {
      console.error('Error creating report:', reportError);
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }

    return res.status(201).json({ success: true });
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
  }
}
