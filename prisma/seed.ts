import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_RULES: { keyword: string; category: string; emoji: string }[] = [
  // 👗 Fashion
  { keyword: 'adidas', category: 'Fashion', emoji: '👗' },
  { keyword: 'nike', category: 'Fashion', emoji: '👗' },
  { keyword: 'gap', category: 'Fashion', emoji: '👗' },
  { keyword: 'zara', category: 'Fashion', emoji: '👗' },
  { keyword: 'h&m', category: 'Fashion', emoji: '👗' },
  { keyword: "levi's", category: 'Fashion', emoji: '👗' },
  { keyword: 'forever21', category: 'Fashion', emoji: '👗' },
  { keyword: 'nordstrom', category: 'Fashion', emoji: '👗' },
  { keyword: "macy's", category: 'Fashion', emoji: '👗' },
  { keyword: 'ralph lauren', category: 'Fashion', emoji: '👗' },
  { keyword: 'tommy hilfiger', category: 'Fashion', emoji: '👗' },
  { keyword: 'under armour', category: 'Fashion', emoji: '👗' },
  { keyword: 'lululemon', category: 'Fashion', emoji: '👗' },
  { keyword: 'reebok', category: 'Fashion', emoji: '👗' },
  { keyword: 'uniqlo', category: 'Fashion', emoji: '👗' },
  { keyword: 'express', category: 'Fashion', emoji: '👗' },
  { keyword: 'old navy', category: 'Fashion', emoji: '👗' },
  { keyword: 'banana republic', category: 'Fashion', emoji: '👗' },
  { keyword: 'coach', category: 'Fashion', emoji: '👗' },
  { keyword: 'kate spade', category: 'Fashion', emoji: '👗' },
  // 💄 Beauty
  { keyword: 'sephora', category: 'Beauty', emoji: '💄' },
  { keyword: 'ulta', category: 'Beauty', emoji: '💄' },
  { keyword: 'mac', category: 'Beauty', emoji: '💄' },
  { keyword: 'clinique', category: 'Beauty', emoji: '💄' },
  { keyword: 'lancome', category: 'Beauty', emoji: '💄' },
  { keyword: 'estee lauder', category: 'Beauty', emoji: '💄' },
  { keyword: 'morphe', category: 'Beauty', emoji: '💄' },
  { keyword: 'fenty', category: 'Beauty', emoji: '💄' },
  { keyword: 'beauty bay', category: 'Beauty', emoji: '💄' },
  // 💻 Electronics
  { keyword: 'apple', category: 'Electronics', emoji: '💻' },
  { keyword: 'samsung', category: 'Electronics', emoji: '💻' },
  { keyword: 'dell', category: 'Electronics', emoji: '💻' },
  { keyword: 'hp', category: 'Electronics', emoji: '💻' },
  { keyword: 'lenovo', category: 'Electronics', emoji: '💻' },
  { keyword: 'microsoft', category: 'Electronics', emoji: '💻' },
  { keyword: 'bestbuy', category: 'Electronics', emoji: '💻' },
  { keyword: 'best buy', category: 'Electronics', emoji: '💻' },
  { keyword: 'newegg', category: 'Electronics', emoji: '💻' },
  { keyword: 'anker', category: 'Electronics', emoji: '💻' },
  { keyword: 'sony', category: 'Electronics', emoji: '💻' },
  // 🍔 Food & Dining
  { keyword: 'doordash', category: 'Food & Dining', emoji: '🍔' },
  { keyword: 'grubhub', category: 'Food & Dining', emoji: '🍔' },
  { keyword: 'ubereats', category: 'Food & Dining', emoji: '🍔' },
  { keyword: 'dominos', category: 'Food & Dining', emoji: '🍔' },
  { keyword: "domino's", category: 'Food & Dining', emoji: '🍔' },
  { keyword: 'chipotle', category: 'Food & Dining', emoji: '🍔' },
  { keyword: 'pizza hut', category: 'Food & Dining', emoji: '🍔' },
  { keyword: 'instacart', category: 'Food & Dining', emoji: '🍔' },
  { keyword: 'whole foods', category: 'Food & Dining', emoji: '🍔' },
  // ✈️ Travel
  { keyword: 'expedia', category: 'Travel', emoji: '✈️' },
  { keyword: 'hotels.com', category: 'Travel', emoji: '✈️' },
  { keyword: 'booking', category: 'Travel', emoji: '✈️' },
  { keyword: 'airbnb', category: 'Travel', emoji: '✈️' },
  { keyword: 'united', category: 'Travel', emoji: '✈️' },
  { keyword: 'delta', category: 'Travel', emoji: '✈️' },
  { keyword: 'marriott', category: 'Travel', emoji: '✈️' },
  { keyword: 'hilton', category: 'Travel', emoji: '✈️' },
  { keyword: 'hertz', category: 'Travel', emoji: '✈️' },
  { keyword: 'enterprise', category: 'Travel', emoji: '✈️' },
  { keyword: 'priceline', category: 'Travel', emoji: '✈️' },
  // 🏥 Health
  { keyword: 'cvs', category: 'Health', emoji: '🏥' },
  { keyword: 'walgreens', category: 'Health', emoji: '🏥' },
  { keyword: 'rite aid', category: 'Health', emoji: '🏥' },
  { keyword: '1800petmeds', category: 'Health', emoji: '🏥' },
  { keyword: 'vitaminshoppe', category: 'Health', emoji: '🏥' },
  { keyword: 'gnc', category: 'Health', emoji: '🏥' },
  { keyword: 'iherb', category: 'Health', emoji: '🏥' },
  // 🏠 Home & Garden
  { keyword: 'wayfair', category: 'Home & Garden', emoji: '🏠' },
  { keyword: 'home depot', category: 'Home & Garden', emoji: '🏠' },
  { keyword: 'lowes', category: 'Home & Garden', emoji: '🏠' },
  { keyword: "lowe's", category: 'Home & Garden', emoji: '🏠' },
  { keyword: 'ikea', category: 'Home & Garden', emoji: '🏠' },
  { keyword: 'pottery barn', category: 'Home & Garden', emoji: '🏠' },
  { keyword: 'crate and barrel', category: 'Home & Garden', emoji: '🏠' },
  { keyword: 'williams sonoma', category: 'Home & Garden', emoji: '🏠' },
  // 🎮 Gaming
  { keyword: 'gamestop', category: 'Gaming', emoji: '🎮' },
  { keyword: 'nintendo', category: 'Gaming', emoji: '🎮' },
  { keyword: 'playstation', category: 'Gaming', emoji: '🎮' },
  { keyword: 'xbox', category: 'Gaming', emoji: '🎮' },
  { keyword: 'razer', category: 'Gaming', emoji: '🎮' },
  { keyword: 'corsair', category: 'Gaming', emoji: '🎮' },
  // 🏃 Sports
  { keyword: "dick's sporting goods", category: 'Sports', emoji: '🏃' },
  { keyword: 'dicks sporting goods', category: 'Sports', emoji: '🏃' },
  { keyword: 'rei', category: 'Sports', emoji: '🏃' },
  { keyword: 'columbia', category: 'Sports', emoji: '🏃' },
  { keyword: 'patagonia', category: 'Sports', emoji: '🏃' },
  { keyword: 'the north face', category: 'Sports', emoji: '🏃' },
  { keyword: 'north face', category: 'Sports', emoji: '🏃' },
  // 🐾 Pets
  { keyword: 'petsmart', category: 'Pets', emoji: '🐾' },
  { keyword: 'petco', category: 'Pets', emoji: '🐾' },
  { keyword: 'chewy', category: 'Pets', emoji: '🐾' },
  // 📚 Education
  { keyword: 'chegg', category: 'Education', emoji: '📚' },
  { keyword: 'coursera', category: 'Education', emoji: '📚' },
  { keyword: 'skillshare', category: 'Education', emoji: '📚' },
  { keyword: 'udemy', category: 'Education', emoji: '📚' },
  // 🛒 General retail (catch-all well-knowns)
  { keyword: 'amazon', category: 'General', emoji: '🛒' },
  { keyword: 'ebay', category: 'General', emoji: '🛒' },
  { keyword: 'walmart', category: 'General', emoji: '🛒' },
  { keyword: 'target', category: 'General', emoji: '🛒' },
  { keyword: 'costco', category: 'General', emoji: '🛒' },
]

async function main() {
  console.log('🌱 Seeding default category rules...')
  let created = 0
  let skipped = 0

  for (const rule of DEFAULT_RULES) {
    const existing = await prisma.categoryRule.findUnique({ where: { keyword: rule.keyword } })
    if (!existing) {
      await prisma.categoryRule.create({ data: rule })
      created++
    } else {
      skipped++
    }
  }

  console.log(`✅ Done: ${created} created, ${skipped} already existed.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
