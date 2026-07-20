import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .gte('expires_at', today)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }

    return res.status(200).json(data);
  } else if (req.method === 'POST') {
    const {
      type,
      direction,
      from_city,
      to_city,
      date,
      weight_kg,
      luggage_count,
      categories,
      category_other,
      weight,
      note,
      contact,
      contact_type,
      contact2,
      contact2_type,
      honeypot
    } = req.body || {};

    if (honeypot) {
      return res.status(400).json({ error: 'Spam aniqlandi' });
    }

    if (!type || !from_city || !to_city || !date || !weight || !contact) {
      return res.status(400).json({ error: 'Majburiy maydonlar to\'ldirilmagan' });
    }

    if (type !== 'traveler' && type !== 'request') {
      return res.status(400).json({ error: 'Noto\'g\'ri e\'lon turi' });
    }

    if (direction && direction !== 'k2u' && direction !== 'u2k') {
      return res.status(400).json({ error: 'Noto\'g\'ri yo\'nalish' });
    }

    const isContactType = (v: unknown) => v === 'telegram' || v === 'phone';
    if (!isContactType(contact_type) || (contact2 && !isContactType(contact2_type))) {
      return res.status(400).json({ error: 'Noto\'g\'ri aloqa turi' });
    }

    const postDate = new Date(date);
    if (isNaN(postDate.getTime())) {
      return res.status(400).json({ error: 'Noto\'g\'ri sana formati' });
    }

    postDate.setDate(postDate.getDate() + 1);
    const expires_at = postDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('posts')
      .insert([
        {
          type,
          direction: direction || null,
          from_city,
          to_city,
          date,
          weight_kg: Number(weight_kg) || 0,
          luggage_count: Number(luggage_count) || 0,
          categories: Array.isArray(categories) ? categories : [],
          category_other: category_other || null,
          weight,
          note: note || null,
          contact,
          contact_type,
          contact2: contact2 || null,
          contact2_type: contact2 ? contact2_type : null,
          expires_at
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }

    return res.status(201).json(data);
  } else {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  }
}
