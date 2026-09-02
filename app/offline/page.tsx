import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section>
        <span className="offline-icon" aria-hidden="true">GR</span>
        <p className="eyebrow">Connection unavailable</p>
        <h1>You are currently offline.</h1>
        <p>
          Reconnect to submit road photographs, capture verified GPS data and
          view the latest report statuses. Images are not uploaded while offline.
        </p>
        <Link className="button primary" href="/collect">Try the collector again</Link>
      </section>
    </main>
  );
}
