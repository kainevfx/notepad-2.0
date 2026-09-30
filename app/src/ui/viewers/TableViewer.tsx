// CSV / TSV shown as a grid (the Source view edits the text).
import { useMemo } from 'preact/hooks';
import type { ViewerProps } from '../ViewerPane';
import { parseCsv, detectDelimiter } from '../../lib/csv';
import { Grid } from './Grid';

export function TableViewer({ doc, text }: ViewerProps) {
  const { rows, truncated } = useMemo(() => parseCsv(text, detectDelimiter(text, doc.path)), [text, doc.path]);
  return <Grid rows={rows} truncated={truncated} />;
}
