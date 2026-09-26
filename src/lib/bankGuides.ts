// Step-by-step guides for getting a statement out of the biggest US card issuers' apps and websites.
// Static text shipped with the app: nothing is fetched. Banks move their buttons, so keep these short,
// name the menu the bank itself uses, and update GUIDES_CHECKED whenever they're re-checked.
// Sources: each bank's public help pages (and Apple Support for Apple Card), September 2026.

export interface BankGuide {
  id: string
  name: string
  /** Getting a statement PDF in the bank's phone app. */
  phone: string[]
  /** Getting a CSV of purchases from the bank's website, on a computer. */
  computer: string[]
  /** Anything worth knowing about this bank's files. */
  note?: string
}

/** When the guides were last checked against the banks' own help pages. */
export const GUIDES_CHECKED = 'September 2026'

export const BANK_GUIDES: BankGuide[] = [
  {
    id: 'chase',
    name: 'Chase',
    phone: [
      'Open the Chase Mobile app and tap the menu at the top left.',
      'Tap Statements & documents, then your card.',
      'Pick the month, open the statement, and save the PDF.',
    ],
    computer: [
      'Sign in at chase.com and open your card.',
      'Tap the download icon above your transactions.',
      'Choose Spreadsheet (Excel, CSV), pick the statement, and download it.',
    ],
  },
  {
    id: 'amex',
    name: 'American Express',
    phone: [
      'Open the Amex app and go to Statements & Activity.',
      'Tap Statements and pick the billing period.',
      'Open the PDF and save it.',
    ],
    computer: [
      'Sign in at americanexpress.com and go to Statements & Activity.',
      'Pick the statement you want, then choose Download.',
      'Choose CSV and download it.',
    ],
  },
  {
    id: 'capital-one',
    name: 'Capital One',
    phone: [
      'Open the Capital One app and tap your card.',
      'Look for Statements, then pick the month.',
      'Open the PDF and save it.',
    ],
    computer: [
      'Sign in at capitalone.com and open your card.',
      'Choose Download transactions.',
      'Pick CSV and the dates you want, then download it.',
    ],
    note: 'Capital One’s CSV covers up to about 90 days. For an older month, use the statement PDF.',
  },
  {
    id: 'citi',
    name: 'Citi',
    phone: [
      'Open the Citi Mobile app and tap your card.',
      'Look for Statements, then pick the month.',
      'Open the PDF and save it.',
    ],
    computer: [
      'Sign in at citi.com and open your card’s activity.',
      'Choose Download Transactions.',
      'Pick a statement or date range, choose CSV, and download it.',
    ],
  },
  {
    id: 'bofa',
    name: 'Bank of America',
    phone: [
      'Open the Bank of America app and tap your credit card.',
      'Under Account Management, tap Statements & Documents.',
      'Pick a statement, then download or share the PDF.',
    ],
    computer: [
      'Sign in to Online Banking and open your credit card.',
      'Choose Download above your transactions.',
      'Pick the statement period, choose the spreadsheet (CSV) format, and download it.',
    ],
  },
  {
    id: 'discover',
    name: 'Discover',
    phone: [
      'Open the Discover app and tap More at the bottom right.',
      'Tap Statements and Tax Documents, then pick the month.',
      'Download the PDF.',
    ],
    computer: [
      'Sign in at discover.com and open your card’s activity.',
      'Choose Download.',
      'Pick CSV and download it.',
    ],
  },
  {
    id: 'wells-fargo',
    name: 'Wells Fargo',
    phone: [
      'Open the Wells Fargo app and tap your card.',
      'Tap Statements & Documents, then pick the month.',
      'Download the PDF.',
    ],
    computer: [
      'Sign in at wellsfargo.com and open your card.',
      'Choose Download Account Activity.',
      'Pick the dates, choose Comma Delimited (CSV), and download it.',
    ],
  },
  {
    id: 'apple-card',
    name: 'Apple Card',
    phone: [
      'Open the Wallet app and tap Apple Card.',
      'Tap Card Balance, then pick a monthly statement.',
      'Tap Download PDF Statement, or Export Transactions and choose CSV.',
    ],
    computer: [],
    note: 'Apple Card statements live on your iPhone, in the Wallet app, so there’s no website step.',
  },
  {
    id: 'other',
    name: 'Another bank',
    phone: [
      'Open your bank’s app and tap your card.',
      'Look for Statements, or Statements & Documents.',
      'Pick the month and save the PDF.',
    ],
    computer: [
      'Sign in on your bank’s website and open your card’s activity.',
      'Look for Download or Export, often a small icon above your transactions.',
      'Choose CSV, Spreadsheet, or Excel, and download it.',
    ],
  },
]
