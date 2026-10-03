// What a CV file may be, and how a stored CV reference is read. PURE — no
// Supabase, no browser — so `npm run test:lib` asserts it under plain Node.
//
// CVs live in the PRIVATE `cvs` bucket (20261003130000): personal data, so there
// is no public URL, and a CV is opened through a signed link that lasts a minute.
// A row stores where the file is as `storage:cvs/<object>`; rows written while
// the bucket was public hold its public URL, which names the same object, so both
// are read the same way. Anything else in `cv_url` is an outside link.
export const CV_BUCKET = 'cvs'
export const CV_PREFIX = `storage:${CV_BUCKET}/`
export const CV_MAX_BYTES = 10 * 1024 * 1024

// The types the "Attach CV" button offers — and the bucket's own allow-list. The
// stored object's extension comes from HERE, never from the name of the file
// someone picked.
export const CV_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
}
// Only consulted when the browser names no type at all — Windows does that for a
// .docx when Word isn't installed. The bucket still checks what is sent.
const EXT_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

// { type, ext } for a file that may be stored, or { error } saying why not.
export function cvFileCheck(file) {
  const name = String(file?.name ?? '')
  const dot = name.lastIndexOf('.')
  const fromName = dot > -1 ? EXT_TYPES[name.slice(dot + 1).toLowerCase()] : undefined
  const type = file?.type || fromName || ''
  const ext = CV_TYPES[type]
  if (!ext) return { error: 'A CV has to be a PDF, a Word document or an image.' }
  if (!(file.size <= CV_MAX_BYTES)) return { error: 'A CV can be at most 10 MB.' }
  return { type, ext }
}

// The object inside our bucket that a stored reference names, or null for an
// outside link (or nothing).
export function cvObjectPath(cvUrl) {
  const s = String(cvUrl ?? '')
  if (s.startsWith(CV_PREFIX)) return s.slice(CV_PREFIX.length) || null
  const m = s.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/cvs\/([^?#]+)/)
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}
