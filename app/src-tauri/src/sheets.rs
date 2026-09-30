//! Spreadsheets (.xlsx, .xls, .ods) read for the sheet viewer: every sheet as a grid of cell
//! text, shown the way Excel displays the values. Read-only.

use calamine::{open_workbook_auto, CellErrorType, Data, Reader};
use serde::Serialize;
use std::path::Path;

#[derive(Serialize, Debug)]
pub struct Sheet {
    pub name: String,
    pub rows: Vec<Vec<String>>,
    pub truncated: bool,
}

#[derive(Serialize, Debug)]
pub struct Workbook {
    pub sheets: Vec<Sheet>,
}

/// Days since 1970-01-01 → (year, month, day), proleptic Gregorian (Howard Hinnant's algorithm).
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (yoe + era * 400 + i64::from(m <= 2), m, d)
}

/// An Excel serial date (days since 1899-12-30) as dd/mm/yyyy, plus hh:mm when it has a time.
fn excel_date(serial: f64) -> String {
    let days = serial.floor();
    let (y, m, d) = civil_from_days(days as i64 - 25_569);
    let mins = ((serial - days) * 1440.0).round() as i64;
    if mins > 0 && mins < 1440 {
        format!("{d:02}/{m:02}/{y} {:02}:{:02}", mins / 60, mins % 60)
    } else {
        format!("{d:02}/{m:02}/{y}")
    }
}

fn cell_text(c: &Data) -> String {
    match c {
        Data::Empty => String::new(),
        Data::String(s) => s.clone(),
        Data::Int(i) => i.to_string(),
        Data::Float(f) => f.to_string(),
        Data::Bool(b) => (if *b { "TRUE" } else { "FALSE" }).into(),
        Data::DateTime(d) if d.is_datetime() => excel_date(d.as_f64()),
        Data::DateTime(d) => d.as_f64().to_string(),
        Data::DateTimeIso(s) | Data::DurationIso(s) => s.clone(),
        Data::Error(e) => match e {
            CellErrorType::Div0 => "#DIV/0!",
            CellErrorType::NA => "#N/A",
            CellErrorType::Name => "#NAME?",
            CellErrorType::Null => "#NULL!",
            CellErrorType::Num => "#NUM!",
            CellErrorType::Ref => "#REF!",
            CellErrorType::Value => "#VALUE!",
            _ => "#ERROR",
        }
        .into(),
    }
}

/// Every sheet, rows from A1 (empty leading rows/columns kept so cells stay where Excel shows
/// them), stopping at `max_cells` per sheet on a whole row.
pub fn read_sheet(path: &Path, max_cells: usize) -> Result<Workbook, String> {
    let fail = |e: &dyn std::fmt::Display| format!("Couldn't read this workbook: {e}");
    let mut wb = open_workbook_auto(path).map_err(|e| fail(&e))?;
    let mut sheets = Vec::new();
    for name in wb.sheet_names() {
        let range = wb.worksheet_range(&name).map_err(|e| fail(&e))?;
        let (r0, c0) = range.start().unwrap_or((0, 0));
        let width = c0 as usize + range.width();
        let mut rows: Vec<Vec<String>> = Vec::new();
        let mut cells = 0usize;
        let mut truncated = false;
        let lead = (0..r0).map(|_| vec![String::new(); width]);
        let body = range.rows().map(|r| {
            let mut row = vec![String::new(); c0 as usize];
            row.extend(r.iter().map(cell_text));
            row
        });
        for row in lead.chain(body) {
            if cells + width > max_cells {
                truncated = true;
                break;
            }
            cells += width;
            rows.push(row);
        }
        if range.is_empty() {
            rows.clear();
        }
        sheets.push(Sheet { name, rows, truncated });
    }
    Ok(Workbook { sheets })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_values_dates_formula_results_and_two_sheets() {
        let p = std::env::temp_dir().join(format!("np2-sheet-{}.xlsx", std::process::id()));
        let mut wb = rust_xlsxwriter::Workbook::new();
        let date = rust_xlsxwriter::Format::new().set_num_format("dd/mm/yyyy");
        {
            let s = wb.add_worksheet().set_name("Cast").unwrap();
            s.write_string(0, 0, "Name").unwrap();
            s.write_string(0, 1, "Fee").unwrap();
            s.write_string(1, 0, "Ann").unwrap();
            s.write_number(1, 1, 1250.5).unwrap();
            s.write_number(2, 0, 3.0).unwrap();
            s.write_formula(2, 1, rust_xlsxwriter::Formula::new("=B2*2").set_result("2501")).unwrap();
            s.write_boolean(3, 1, true).unwrap();
            let d = rust_xlsxwriter::ExcelDateTime::from_ymd(2026, 9, 30).unwrap();
            s.write_datetime_with_format(3, 0, &d, &date).unwrap();
        }
        wb.add_worksheet().set_name("Notes").unwrap().write_string(0, 0, "hi").unwrap();
        wb.save(&p).unwrap();
        let w = read_sheet(&p, 1000).unwrap();
        assert_eq!(w.sheets.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(), ["Cast", "Notes"]);
        let r = &w.sheets[0].rows;
        assert_eq!(r[0], ["Name", "Fee"]);
        assert_eq!(r[1], ["Ann", "1250.5"]);
        assert_eq!(r[2], ["3", "2501"]);
        assert_eq!(r[3], ["30/09/2026", "TRUE"]);
        assert!(!w.sheets[0].truncated);
        std::fs::remove_file(&p).ok();
    }

    #[test]
    fn a_sheet_starting_below_a1_keeps_its_place() {
        let p = std::env::temp_dir().join(format!("np2-off-{}.xlsx", std::process::id()));
        let mut wb = rust_xlsxwriter::Workbook::new();
        wb.add_worksheet().write_string(2, 1, "C").unwrap();
        wb.save(&p).unwrap();
        let w = read_sheet(&p, 1000).unwrap();
        assert_eq!(w.sheets[0].rows, vec![vec!["", ""], vec!["", ""], vec!["", "C"]]);
        std::fs::remove_file(&p).ok();
    }

    #[test]
    fn caps_cells_at_whole_rows() {
        let p = std::env::temp_dir().join(format!("np2-cap-{}.xlsx", std::process::id()));
        let mut wb = rust_xlsxwriter::Workbook::new();
        {
            let s = wb.add_worksheet();
            for r in 0..10 {
                s.write_number(r, 0, r as f64).unwrap();
                s.write_number(r, 1, 1.0).unwrap();
            }
        }
        wb.save(&p).unwrap();
        let w = read_sheet(&p, 6).unwrap();
        assert_eq!(w.sheets[0].rows.len(), 3);
        assert!(w.sheets[0].truncated);
        std::fs::remove_file(&p).ok();
    }

    #[test]
    fn not_a_workbook_is_an_error() {
        let p = std::env::temp_dir().join(format!("np2-bad-{}.xlsx", std::process::id()));
        std::fs::write(&p, "not a zip").unwrap();
        assert!(read_sheet(&p, 10).is_err());
        std::fs::remove_file(&p).ok();
    }
}
