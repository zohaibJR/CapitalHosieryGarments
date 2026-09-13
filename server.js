require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI. Add it to .env before starting the server.');
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

const cleanJson = {
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    return ret;
  }
};

const Product = mongoose.model('Product', new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  sku: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  season: { type: String, required: true, trim: true },
  cost: { type: Number, required: true, min: 0 },
  wsale: { type: Number, required: true, min: 0 },
  retail: { type: Number, required: true, min: 0 },
  minStock: { type: Number, default: 0, min: 0 },
  unit: { type: String, default: 'pcs', trim: true },
  packSize: { type: Number, default: 1, min: 1 },
  active: { type: Boolean, default: true }
}, { timestamps: true, toJSON: cleanJson }));

const City = mongoose.model('City', new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true }
}, { timestamps: true, toJSON: cleanJson }));

const Customer = mongoose.model('Customer', new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  city: { type: String, required: true, trim: true },
  shop: { type: String, required: true, trim: true },
  owner: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  opening: { type: Number, default: 0, min: 0 },
  creditLimit: { type: Number, default: 0, min: 0 }
}, { timestamps: true, toJSON: cleanJson }));

const Vendor = mongoose.model('Vendor', new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  contact: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  opening: { type: Number, default: 0, min: 0 }
}, { timestamps: true, toJSON: cleanJson }));

const LedgerEntry = mongoose.model('LedgerEntry', new mongoose.Schema({
  id: { type: Number, required: true, unique: true, index: true },
  type: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  time: String,
  customerId: String,
  customerName: String,
  vendorId: String,
  productId: String,
  saleId: Number,
  purchaseId: Number,
  lineId: String,
  invoiceRef: String,
  method: String,
  shop: String,
  qty: Number,
  packQty: Number,
  amount: Number,
  paidNow: Number,
  price: Number,
  reason: String,
  notes: String,
  items: [{
    productId: String,
    qty: Number,
    price: Number,
    packQty: Number,
    lineId: String
  }]
}, { timestamps: true, toJSON: cleanJson }));

async function readState() {
  const [products, cityDocs, customers, vendors, ledger] = await Promise.all([
    Product.find().sort({ id: 1 }).lean(),
    City.find().sort({ name: 1 }).lean(),
    Customer.find().sort({ city: 1, shop: 1 }).lean(),
    Vendor.find().sort({ name: 1 }).lean(),
    LedgerEntry.find().sort({ id: 1 }).lean()
  ]);

  return {
    products: products.map(stripMongo),
    cities: cityDocs.map(c => c.name),
    customers: customers.map(stripMongo),
    vendors: vendors.map(stripMongo),
    ledger: ledger.map(stripMongo)
  };
}

function stripMongo(row) {
  const copy = { ...row };
  delete copy._id;
  delete copy.__v;
  delete copy.createdAt;
  delete copy.updatedAt;
  return copy;
}

async function replaceCollection(Model, rows, key = 'id') {
  const ids = rows.map(row => row[key]);
  if (ids.length) await Model.deleteMany({ [key]: { $nin: ids } });
  else await Model.deleteMany({});

  if (!rows.length) return;
  await Model.bulkWrite(rows.map(row => ({
    updateOne: {
      filter: { [key]: row[key] },
      update: { $set: row },
      upsert: true
    }
  })));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'connecting' });
});

app.get('/api/state', async (_req, res, next) => {
  try {
    res.json(await readState());
  } catch (error) {
    next(error);
  }
});

app.put('/api/state', async (req, res, next) => {
  try {
    const { products = [], cities = [], customers = [], vendors = [], ledger = [] } = req.body || {};
    await Promise.all([
      replaceCollection(Product, products),
      replaceCollection(City, cities.map(name => ({ name })), 'name'),
      replaceCollection(Customer, customers),
      replaceCollection(Vendor, vendors),
      replaceCollection(LedgerEntry, ledger)
    ]);
    res.json(await readState());
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Server error' });
});

mongoose.connect(MONGODB_URI)
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Capital Hosiery ledger running at http://localhost:${PORT}`);
    });
    server.on('error', error => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the existing server or change PORT in .env.`);
        process.exit(1);
      }
      throw error;
    });
  })
  .catch(error => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });
