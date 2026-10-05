# Tasks & Todo

## Active Tasks

- [x] Plan & design 10 diverse, realistic mock posts for Korea ↔ Uzbekistan and Russia ↔ Uzbekistan corridors
- [x] Insert the 10 mock posts into the database via Supabase MCP tool (`execute_sql`)
- [x] Update `data/db.json` with the updated mock posts and create a seed helper script in `scripts/seed-mock-posts.ts`
- [x] Verify that `public_posts` view returns all 10 active posts
- [x] Run `npm run lint` and `npm test`
- [x] Test feed rendering locally (launch dev servers if needed and check API/UI)

## Review & Completed Tasks

- **10 Mock Posts Generated & Seeded**:
  - Balanced distribution across post types: 5 travelers (`traveler`) and 5 parcel requests (`request`).
  - Corridors covered: Korea → Uzbekistan (4), Uzbekistan → Korea (4), Russia ↔ Uzbekistan (2).
  - Diverse cities: Seoul, Busan, Daegu, Incheon, Gwangju, Toshkent, Samarqand, Andijon, Buxoro, Farg'ona, Urganch, Namangan, Moskva.
  - Diverse categories: `docs` (Hujjatlar), `clothes` (Kiyim-kechak), `meds` (Dori-darmon), `food` (Oziq-ovqat), `phone` (Telefon/Texnika), `gift` (Sovg'a).
  - Various capacity styles: `15 kg + 1 chamadon`, `23 kg`, `2 chamadon`, `8 kg`, `10 kg + 1 chamadon`, small parcel weights.
  - Active future dates (October 9–22, 2026), including urgent departure dates within 7 days to showcase urgency animations.
  - Fully compliant with SQL check constraints, contact validations (`isValidContact`), and associated with realistic author display names.
- **Artifacts**: Created reusable seed script `scripts/seed-mock-posts.ts` and updated `data/db.json`.
- **Verification**: Verified via `/api/posts`, `public_posts` view, filter endpoints (`country=KR` -> 8, `country=RU` -> 2), and passed `npm run lint` & `npm test` (36 passing tests).
