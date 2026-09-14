// The product name, in ONE place.
//
// Deliberately free of React/JSX and any icon imports: the PDF builders
// (estimatePdf / packingListPdf) print it on their letterhead and those modules
// run under plain Node — that is how the PDFs are tested. The visual mark lives
// in components/Logo.jsx, which re-exports this name for UI code.
export const BRAND_NAME = 'Kitbay'

// Where the studio signs in. One definition, because `npm run user:add` prints
// it to whoever provisions an account and a wrong address there is a support
// call. Change it here when the app moves host.
export const APP_URL = 'https://duck-agency.com/studio-demo/'
