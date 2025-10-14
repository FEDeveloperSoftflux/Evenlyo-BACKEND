
const Item = require('../../models/Item');
const Purchase = require('../../models/Purchase');
const stripe = require('../../config/stripe');
const PaymentIntent = require('../../models/PaymentIntent');
const ServiceItemStockLog = require('../../models/ServiceItemStockLog');

// Create payment intent for item purchase
const createItemPaymentIntent = async (req, res) => {
    try {
        const { itemId, quantity, location } = req.body;
        const currency = 'usd'; // Fixed currency
        
        if (!itemId || !quantity || quantity <= 0 || !location) {
            return res.status(400).json({ 
                success: false, 
                message: 'Required itemId, quantity, or location.' 
            });
        }

        const item = await Item.findById(itemId);
        if (!item) {
            return res.status(404).json({ 
                success: false, 
                message: 'Item not found.' 
            });
        }

        if (item.stockQuantity < quantity) {
            return res.status(400).json({ 
                success: false, 
                message: 'Not enough stock available.' 
            });
        }

        // Get platform fee from settings
        const Settings = require('../../models/Settings');
        const settings = await Settings.findOne();
        const platformFee = (settings.salesItemPlatformFee)/100;

        console.log('Platform Fee:', platformFee);
        
        // Calculate total price with platform fee
        const platformPrice = (quantity * item.sellingPrice) * platformFee;
        const totalPrice = (quantity * item.sellingPrice) + platformPrice;

        console.log('Total Price:', totalPrice);
        console.log('Platform Price:', platformPrice);
        const amount = Math.round(totalPrice * 100); // Convert to cents for Stripe

        // Prepare metadata for Stripe
        const metadata = {
            itemId: String(itemId),
            itemName: item.title.en || item.title,
            quantity: String(quantity),
            location: location,
            userId: String(req.user.id),
            userName: req.user.firstName + ' ' + req.user.lastName,
            platformPrice: String(platformPrice.toFixed(2)),
            totalPrice: String(totalPrice.toFixed(2)),
            vendorId: String(item.vendor),
            type: 'item_purchase'
        };

        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            automatic_payment_methods: { enabled: true },
            metadata,
        });

        // Store payment intent in database
        const dbPaymentIntent = await PaymentIntent.create({
            stripeIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            status: paymentIntent.status,
            amount: totalPrice,
            currency,
            quantity,
            metadata: {
                itemId,
                itemName: item.title.en || item.title,
                quantity,
                location,
                userId: req.user.id,
                userName: req.user.firstName + ' ' + req.user.lastName,
                vendorId: item.vendor,
                type: 'item_purchase'
            }
        });

        return res.status(201).json({
            success: true,
            internalId: dbPaymentIntent.internalId,
            client_secret: paymentIntent.client_secret,
            stripeId: paymentIntent.id,
            item: {
                id: item._id,
                title: item.title,
                sellingPrice: item.sellingPrice,
                quantity: quantity,
                totalPrice: totalPrice
            }
        });

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Complete item purchase after payment confirmation
const buyItem = async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        
        if (!paymentIntentId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Payment intent ID is required.' 
            });
        }

        // Find the payment intent in database
        const dbPaymentIntent = await PaymentIntent.findOne({ 
            internalId: paymentIntentId 
        });
        
        if (!dbPaymentIntent) {
            return res.status(404).json({ 
                success: false, 
                message: 'Payment intent not found.' 
            });
        }

        // Verify payment status with Stripe
        const stripePaymentIntent = await stripe.paymentIntents.retrieve(
            dbPaymentIntent.stripeIntentId
        );

        if (stripePaymentIntent.status !== 'succeeded') {
            return res.status(400).json({ 
                success: false, 
                message: 'Payment not completed yet.' 
            });
        }

        // Check if this purchase has already been processed
        const existingPurchase = await Purchase.findOne({ 
            paymentIntentId: paymentIntentId 
        });
        
        if (existingPurchase) {
            return res.status(400).json({ 
                success: false, 
                message: 'This purchase has already been processed.' 
            });
        }

        // Extract metadata from payment intent
        const metadata = dbPaymentIntent.metadata;
        const itemId = metadata.itemId;
        const quantity = parseInt(metadata.quantity);
        const location = metadata.location;

        // Get item details
        const item = await Item.findById(itemId);
        if (!item) {
            return res.status(404).json({ 
                success: false, 
                message: 'Item not found.' 
            });
        }

        // Check stock availability
        if (item.stockQuantity < quantity) {
            return res.status(400).json({ 
                success: false, 
                message: 'Not enough stock available.' 
            });
        }

        // Reduce stock
        item.stockQuantity -= quantity;
        await item.save();

        // Log checkout for the purchased quantity
        try {
            await ServiceItemStockLog.create({
                item: item._id,
                type: 'checkout',
                quantity,
                note: 'Stock decreased due to purchase',
                createdBy: req.user?._id
            });
        } catch (e) {
            console.warn('Failed to log service item checkout:', e.message);
        }

        // Get vendor info
        const vendorId = item.vendor;
        let vendorName = '';
        let vendorRef = null;
        
        if (vendorId) {
            const Vendor = require('../../models/Vendor');
            const vendor = await Vendor.findById(vendorId);
            if (vendor) {
                vendorName = vendor.businessName || '';
                vendorRef = vendor._id;
            }
        }

        // Create purchase record
        const purchase = new Purchase({
            item: itemId,
            itemName: item.title.en || item.title,
            user: req.user.id,
            userName: req.user.firstName + ' ' + req.user.lastName,
            vendor: vendorRef,
            vendorName,
            quantity,
            location,
            totalPrice: dbPaymentIntent.amount,
            paymentIntentId: paymentIntentId,
            stripePaymentIntentId: dbPaymentIntent.stripeIntentId
        });
        await purchase.save();

        // Update payment intent status
        dbPaymentIntent.status = 'completed';
        await dbPaymentIntent.save();

        return res.status(200).json({ 
            success: true, 
            message: 'Item purchased successfully.', 
            item: {
                id: item._id,
                title: item.title,
                sellingPrice: item.sellingPrice
            },
            purchase 
        });

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Get items by selected category and subcategory
const getItemsByCategory = async (req, res) => {
    try {
        const { categoryId, subCategoryId } = req.query;
        const subCat = (subCategoryId && typeof subCategoryId === 'string') ? subCategoryId.trim() : '';

        // Only query when at least one filter is provided. If neither filter is present,
        // return empty arrays to avoid returning all items accidentally.
        const hasCategory = categoryId && typeof categoryId === 'string' && categoryId.trim() !== '';
        const hasSubCategory = Boolean(subCat);

        if (!hasCategory && !hasSubCategory) {
            return res.status(200).json({ success: true, items: {}, other: {} });
        }

        // Build a single filter that applies both category and subCategory (AND behavior)
        const filteredFilter = {};
        if (hasCategory) filteredFilter.mainCategory = categoryId.trim();
        if (hasSubCategory) filteredFilter.subCategory = subCat;

        // Fetch filtered items
        const filteredItems = await Item.find(filteredFilter);

        // Build aggregation to match 'other' items where mainCategory or subCategory is missing, null, or empty string.
        // Use aggregation so we can safely check for empty strings without forcing Mongoose to cast to ObjectId.
        const otherPipeline = [
            { $match: {
                $or: [
                    { mainCategory: { $exists: false } },
                    { mainCategory: null },
                    { mainCategory: '' },
                    { subCategory: { $exists: false } },
                    { subCategory: null },
                    { subCategory: '' }
                ]
            } },
        ];

        const data = await Item.aggregate(otherPipeline);

        return res.status(200).json({ success: true, items: { data: filteredItems }, other: { data } });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
module.exports = {
    createItemPaymentIntent,
    buyItem,
    getItemsByCategory
};
