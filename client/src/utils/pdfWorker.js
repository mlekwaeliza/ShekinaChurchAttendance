// pdfWorker.js
//
// Thin wrapper around the report-pdf.worker.js Web Worker. The main
// thread calls generateReportPdf(payload) which:
//
//   1. Spins up a fresh worker (Vite splits jspdf into its own chunk
//      so the main bundle doesn't carry 391 kB of PDF code).
//   2. Posts the payload.
//   3. Receives back a Uint8Array + filename.
//   4. Creates a Blob URL and triggers a download via a hidden <a>.
//   5. Terminates the worker.
//
// Using a fresh worker per call (rather than a long-lived singleton)
// is intentional: a worker is cheap to spin up, and a stale worker
// could carry jspdf state between reports. Terminating immediately
// frees the jspdf heap.

let workerCounter = 0;

function nextWorkerId() {
  workerCounter += 1;
  return workerCounter;
}

function downloadBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after the click handler completes. 1s is enough for
  // Chrome/Firefox to begin the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function generateReportPdf(payload) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(
        new URL('../workers/report-pdf.worker.js', import.meta.url),
        { type: 'module' }
      );
    } catch (err) {
      reject(new Error('Could not start PDF worker: ' + (err.message || err)));
      return;
    }

    const id = nextWorkerId();
    let settled = false;

    const cleanup = () => {
      if (!settled) return;
      worker.terminate();
    };

    worker.addEventListener('message', (event) => {
      const { id: msgId, ok, pdf, filename, error } = event.data || {};
      if (msgId !== id) return;
      settled = true;
      cleanup();
      if (ok) {
        try {
          downloadBlob(pdf, filename);
          resolve({ filename });
        } catch (dlErr) {
          reject(dlErr);
        }
      } else {
        reject(new Error(error || 'PDF worker failed'));
      }
    });

    worker.addEventListener('error', (event) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(event.message || 'PDF worker error'));
    });

    worker.postMessage({ id, payload });
  });
}
