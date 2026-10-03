-- CVs are personal data: the `cvs` bucket stops being public (security audit,
-- 3 Oct 2026).
--
-- 20260729120000 made it public "to keep the demo simple", so every CV was
-- readable by anyone holding its URL, and `auth_write_cvs` (FOR ALL) let any
-- signed-in user overwrite or delete anyone's file. The app now opens a CV through
-- a short-lived signed URL, uploads under a random name without upsert, and the
-- bucket itself refuses what the upload button never offered.

-- 1. Private, 10 MB, and only the types the "Attach CV" button accepts
--    (.pdf .doc .docx .png .jpg .jpeg).
update storage.buckets
   set public = false,
       file_size_limit = 10485760,
       allowed_mime_types = array[
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'image/png',
         'image/jpeg'
       ]
 where id = 'cvs';

-- 2. Active team members read (a signed URL needs SELECT) and add files. Nobody
--    overwrites or deletes one from the app: replacing a CV uploads a new object,
--    and the old one stays — the archive-not-delete rule, applied to files.
drop policy if exists "public_read_cvs" on storage.objects;
drop policy if exists "auth_write_cvs" on storage.objects;
create policy "team_read_cvs" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and (select public.is_team_member()));
create policy "team_upload_cvs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cvs' and (select public.is_team_member()));
