import { useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Upload } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import {
  Button,
  Card,
  CardContent,
  LinkSearchField,
  Select,
  messageFromError,
  useMessageDialog,
} from "@/components/ui"
import { searchLink } from "@/services"
import {
  createBankEntries,
  getBankMapping,
  saveBankMapping,
  uploadBankStatement,
} from "../services"
import {
  BANK_TRANSACTION_IMPORT_FIELDS,
  type BankImportResult,
  type BankStatementPreview,
} from "../types"

const PREVIEW_ROWS = 5

// Bank Statement Import wizard — mirrors the Desk "Upload Bank Statement" flow
// (bank_statement_import + bank_transaction_upload.py): pick a Bank Account,
// choose a CSV, map its columns onto Bank Transaction fields, preview, import.
export default function BankStatementImport() {
  const navigate = useNavigate()
  const { showMessage } = useMessageDialog()

  const [bankAccount, setBankAccount] = useState("")
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState<BankStatementPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [result, setResult] = useState<BankImportResult | null>(null)
  const [busy, setBusy] = useState<"" | "upload" | "import">("")

  const activeMapping = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [column, field] of Object.entries(mapping)) {
      if (field) out[column] = field
    }
    return out
  }, [mapping])

  const handleFile = useCallback(
    async (file: File) => {
      if (!bankAccount) {
        showMessage("Bank Account is required")
        return
      }
      setBusy("upload")
      try {
        const content = await file.text()
        const next = await uploadBankStatement(file.name, content)
        const bankMapping = await getBankMapping(bankAccount)
        const initial: Record<string, string> = {}
        for (const column of next.columns) initial[column] = bankMapping[column] ?? ""
        setPreview(next)
        setMapping(initial)
        setFileName(file.name)
        setResult(null)
      } catch (err) {
        showMessage(messageFromError(err, "Failed to read the bank statement."))
      } finally {
        setBusy("")
      }
    },
    [bankAccount, showMessage]
  )

  const handleImport = useCallback(async () => {
    if (!preview) return
    if (!bankAccount) {
      showMessage("Bank Account is required")
      return
    }
    if (Object.keys(activeMapping).length === 0) {
      showMessage("Map at least one column before importing")
      return
    }
    setBusy("import")
    try {
      await saveBankMapping(bankAccount, activeMapping)
      const imported = await createBankEntries({
        columns: preview.columns,
        data: preview.data,
        bankAccount,
      })
      setResult(imported)
      showMessage(
        `Imported ${imported.success} bank transaction(s)${
          imported.errors ? `, ${imported.errors} row(s) failed` : ""
        }.`
      )
      navigate("/bank-reconciliation")
    } catch (err) {
      showMessage(messageFromError(err, "Failed to import the bank statement."))
    } finally {
      setBusy("")
    }
  }, [preview, bankAccount, activeMapping, showMessage, navigate])

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading">Upload Bank Statement</h1>
          <p className="text-sm text-muted mt-1">
            Import a CSV statement, map its columns and create Bank Transactions.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LinkSearchField
                label="Bank Account"
                placeholder="Select Bank Account"
                value={bankAccount}
                searchFn={(query) =>
                  searchLink("Bank Account", query, undefined, [["is_company_account", "=", 1]]).then(
                    (items) => ({
                      items: items.map((i) => ({ ...i, description: i.description ?? "" })),
                    })
                  )
                }
                onChange={(value) => setBankAccount(value ?? "")}
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="bsi-file" className="text-sm font-medium text-body">
                  CSV File
                </label>
                <input
                  id="bsi-file"
                  type="file"
                  accept=".csv"
                  disabled={busy === "upload"}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleFile(file)
                  }}
                  className="block w-full text-sm text-body file:mr-3 file:rounded-md file:border-0 file:bg-primary-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-primary-700"
                />
                {fileName && <span className="text-xs text-muted">{fileName}</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {preview && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-lg font-semibold text-heading">Map Columns</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-muted uppercase tracking-wider">
                      <th className="px-4 py-2">Statement Column</th>
                      <th className="px-4 py-2">Bank Transaction Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {preview.columns.map((column, index) => (
                      <tr key={`${column}-${index}`}>
                        <td className="px-4 py-3 text-body">{column}</td>
                        <td className="px-4 py-3">
                          <Select
                            id={`bsi-map-${index}`}
                            aria-label={column}
                            value={mapping[column] ?? ""}
                            onChange={(e) =>
                              setMapping((m) => ({ ...m, [column]: e.target.value }))
                            }
                          >
                            <option value="">Ignore</option>
                            {BANK_TRANSACTION_IMPORT_FIELDS.map((field) => (
                              <option key={field} value={field}>
                                {field}
                              </option>
                            ))}
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {preview && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-lg font-semibold text-heading">Preview</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-muted uppercase tracking-wider">
                      {preview.columns.map((column) => (
                        <th key={column} className="px-4 py-2 whitespace-nowrap">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {preview.data.slice(0, PREVIEW_ROWS).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {preview.columns.map((column, colIndex) => (
                          <td key={column} className="px-4 py-3 text-body whitespace-nowrap">
                            {row[colIndex] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.data.length > PREVIEW_ROWS && (
                <p className="text-xs text-muted">
                  Showing first {PREVIEW_ROWS} of {preview.data.length} rows.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {result && (
          <p className="text-sm text-body">
            Imported {result.success} transaction(s)
            {result.errors ? `, ${result.errors} failed` : ""}.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/bank-reconciliation")}>
            <ArrowLeft size={16} /> Back
          </Button>
          <Button onClick={handleImport} loading={busy === "import"} disabled={!preview}>
            <Upload size={16} /> Import Transactions
          </Button>
        </div>
      </motion.div>
    </>
  )
}
