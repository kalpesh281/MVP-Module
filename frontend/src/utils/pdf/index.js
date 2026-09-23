import { buildReport, collect, filenameFor } from './report';

/**
 * Download the assessment as a PDF.
 *
 * jsPDF is ~330KB and is imported here, inside the click handler, so it is
 * fetched the first time someone asks for a report and never on a page
 * load. A library that only runs on demand has no business being in the
 * bundle that decides first paint.
 *
 * Generation is synchronous once the module lands, and on the largest
 * payload we have takes well under a second — but the import is a network
 * round trip on a cold cache, which is why the caller is expected to show
 * a pending state rather than assume this returns instantly.
 */
export default async function downloadReport(scan) {
  const { jsPDF } = await import('jspdf');
  const data = collect(scan);
  const pdf = buildReport(jsPDF, data);
  pdf.save(filenameFor(data));
  return data.reference;
}

export { buildReport, collect, filenameFor };
