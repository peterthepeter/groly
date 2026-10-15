import pdfMakeUrl from 'pdfmake/build/pdfmake.min.js?url';
import normal from 'pdfmake/fonts/Roboto/Roboto-Regular.ttf?url';
import bold from 'pdfmake/fonts/Roboto/Roboto-Medium.ttf?url';
import italics from 'pdfmake/fonts/Roboto/Roboto-Italic.ttf?url';
import bolditalics from 'pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf?url';

type PdfMake = typeof import('pdfmake/build/pdfmake');
let loading: Promise<PdfMake> | undefined;

export function loadPdfRuntime(): Promise<PdfMake> {
	return loading ??= (async () => {
		// pdfmake distributes an already bundled browser runtime. Load its exact
		// minified asset once rather than wrapping/rebundling that opaque bundle.
		await import(/* @vite-ignore */ pdfMakeUrl);
		const pdfMake = (globalThis as typeof globalThis & { pdfMake?: PdfMake }).pdfMake;
		if (!pdfMake?.createPdf) throw new Error('PDF runtime did not initialize');
		// Keep all four original Roboto faces as cacheable binary assets instead
		// of expanding them into an 850 KB base64 JavaScript font bundle.
		// PDFMake recognizes remote fonts by their absolute HTTP(S) URL. Kit's
		// root-relative asset paths must not be interpreted as virtual filenames.
		const absolute = (asset: string) => new URL(asset, document.baseURI).href;
		pdfMake.addFonts({ Roboto: { normal: absolute(normal), bold: absolute(bold), italics: absolute(italics), bolditalics: absolute(bolditalics) } });
		return pdfMake;
	})().catch(error => {
		loading = undefined;
		throw error;
	});
}
