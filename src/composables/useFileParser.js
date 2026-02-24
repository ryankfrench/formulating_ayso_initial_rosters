import { ref } from 'vue'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export function useFileParser() {
  const rows = ref([])
  const columns = ref([])
  const fileName = ref('')
  const error = ref('')
  const parsing = ref(false)

  function normalizeRows(rawRows) {
    if (!rawRows || rawRows.length === 0) {
      throw new Error('File contains no data rows.')
    }
    const cols = Object.keys(rawRows[0])
    if (cols.length === 0) {
      throw new Error('No columns detected in file.')
    }
    const cleaned = rawRows
      .filter(row => cols.some(c => row[c] !== null && row[c] !== undefined && String(row[c]).trim() !== ''))
    if (cleaned.length === 0) {
      throw new Error('All rows are empty.')
    }
    return { cols, cleaned }
  }

  function parseCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete(results) {
          if (results.errors.length > 0) {
            const msg = results.errors.map(e => e.message).join('; ')
            reject(new Error(`CSV parse errors: ${msg}`))
            return
          }
          resolve(results.data)
        },
        error(err) {
          reject(err)
        }
      })
    })
  }

  function parseXLSX(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
          resolve(data)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file.'))
      reader.readAsArrayBuffer(file)
    })
  }

  async function parseFile(file) {
    error.value = ''
    parsing.value = true
    rows.value = []
    columns.value = []
    fileName.value = file.name

    try {
      const ext = file.name.split('.').pop().toLowerCase()
      let rawRows
      if (ext === 'csv') {
        rawRows = await parseCSV(file)
      } else if (ext === 'xlsx' || ext === 'xls') {
        rawRows = await parseXLSX(file)
      } else {
        throw new Error(`Unsupported file type: .${ext}. Please use .csv or .xlsx`)
      }

      const { cols, cleaned } = normalizeRows(rawRows)
      columns.value = cols
      rows.value = cleaned
    } catch (err) {
      error.value = err.message || 'Failed to parse file.'
      rows.value = []
      columns.value = []
    } finally {
      parsing.value = false
    }
  }

  function reset() {
    rows.value = []
    columns.value = []
    fileName.value = ''
    error.value = ''
  }

  return { rows, columns, fileName, error, parsing, parseFile, reset }
}
