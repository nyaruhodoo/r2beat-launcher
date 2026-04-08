import { GiftItemTableRow } from '@src/types'
import { Dexie, type EntityTable } from 'dexie'

const db = new Dexie('LotteryDatabase') as Dexie & {
  storedGiftItems: EntityTable<
    GiftItemTableRow,
    'idx' // primary key "idx" (for the typings only)
  >
}

// Schema declaration:
db.version(1).stores({
  storedGiftItems: 'idx', // primary key "idx" (for the runtime!)
})

export { db }
