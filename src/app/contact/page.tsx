import { redirect } from 'next/navigation'

// The standalone contact page has been merged into the in-app Contact Support
// experience at /messages. Redirect any old links / bookmarks there.
export default function ContactPage() {
  redirect('/messages')
}
