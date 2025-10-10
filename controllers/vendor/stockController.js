const Listing = require('../../models/Listing');
const StockLog = require('../../models/StockLog');

// Helper to get listing name
function getListingName(listing) {
  return listing.title?.en || listing.title?.nl || listing.title || '';
}

exports.createStockEvent = async (req, res) => {
  try {
    const { listingId, type, quantity, note } = req.body;
    if (!['checkin', 'checkout', 'missing', 'stockin'].includes(type)) {
      return res.status(400).json({ error: 'Invalid stock event type.' });
    }
    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });

    // Update quantity for stockin only
    if (type === 'stockin') {
      listing.quantity = quantity;
      await listing.save();
    }
    // For checkin, increase quantity
    if (type === 'checkin') {
      listing.quantity += quantity;
      await listing.save();
    }
    // For checkout or missing, decrease quantity
    if (type === 'checkout' || type === 'missing') {
      if (listing.quantity < quantity) {
        return res.status(400).json({ error: 'Not enough stock.' });
      }
      listing.quantity -= quantity;
      await listing.save();
    }
    const log = await StockLog.create({
      listing: listingId,
      type,
      quantity,
      note,
      createdBy: req.user?._id
    });
    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Tabular GET endpoints
exports.getStockTable = async (req, res) => {
  try {
    const { type } = req.params;
    if (!['checkin', 'checkout', 'missing', 'stockin'].includes(type)) {
      return res.status(400).json({ error: 'Invalid stock event type.' });
    }
    const logs = await StockLog.find({ type }).populate('listing');
    const table = logs.map((log, idx) => {
      const listing = log.listing;
      const name = getListingName(listing);
      if (type === 'checkin') {
        return {
          SNo: idx + 1,
          ListingID: listing._id,
          Name: name,
          'Check In (Quantity)': log.quantity,
          'Stock In (Date Time)': log.dateTime
        };
      } else if (type === 'checkout') {
        return {
          SNo: idx + 1,
          ListingID: listing._id,
          Name: name,
          'Reserved for booking': log.quantity,
          'Stock In (Date Time)': log.dateTime
        };
      } else if (type === 'missing') {
        return {
          SNo: idx + 1,
          ListingID: listing._id,
          Name: name,
          'Missing Items': log.quantity,
          'Stock Out': log.dateTime
        };
      } else if (type === 'stockin') {
        return {
          SNo: idx + 1,
          ListingID: listing._id,
          Name: name,
          'In Stock (Quantity)': log.quantity
        };
      }
    });
    res.json({ table });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Return stock logs separated into checkins and checkouts (and others)
exports.getStockLogs = async (req, res) => {
  try {
    // Optionally filter by vendor if needed in the future; for now return all logs
    const checkins = await StockLog.find({ type: { $in: ['checkin', 'stockin'] } }).populate('listing').sort({ dateTime: -1 });
    const checkouts = await StockLog.find({ type: 'checkout' }).populate('listing').sort({ dateTime: -1 });
    const missing = await StockLog.find({ type: 'missing' }).populate('listing').sort({ dateTime: -1 });

    // Map to a lighter object for API
    const mapLog = (log) => ({
      id: log._id,
      listingId: log.listing?._id,
      listingTitle: log.listing ? (log.listing.title?.en || log.listing.title) : '',
      type: log.type,
      quantity: log.quantity,
      note: log.note,
      dateTime: log.dateTime,
      createdBy: log.createdBy
    });

    res.json({
      success: true,
      checkins: checkins.map(mapLog),
      checkouts: checkouts.map(mapLog),
      missing: missing.map(mapLog)
    });
  } catch (err) {
    console.error('getStockLogs error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
