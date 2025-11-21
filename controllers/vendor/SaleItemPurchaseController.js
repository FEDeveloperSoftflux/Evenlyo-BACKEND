const SaleItem = require('../../models/SaleItemPurchase');
const Item = require('../../models/Item');
const mongoose = require('mongoose');


const createSaleItemOrder = async (req, res) => {
    try {
        let trackId = Math.floor(10000000 + Math.random() * 90000000).toString();

        const { items } = req.body;

        if (!items || items.length === 0)
            return res.status(400).send({ message: "Items required" });

        // 🔹 1. Validate stock for all items first
        for (const item of items) {
            const product = await Item.findById(item.itemId);

            if (!product) {
                return res.status(404).send({ message: "Item not found" });
            }

            if (product.stockQuantity < item.quantity) {
                return res.status(400).send({
                    message: `Not enough stock for item: ${product.title?.en || product.title}`
                });
            }
        }

        // 🔹 2. If all good → subtract stock
        for (const item of items) {
            await Item.updateOne(
                { _id: item.itemId },
                { $inc: { stockQuantity: -item.quantity } }
            );
        }

        // 🔹 3. Create order
        const newOrder = await SaleItem.create({
            ...req.body,
            trackingId: trackId,
            customerId: req.user.id,
        });

        res.status(200).send({
            message: "Order Created Successfully",
            order: newOrder,
        });

    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};


const getSaleItemHistory = async (req, res) => {
    try {
        const { id } = req.user
        console.log(id,"idididid");
        
        const allData = await SaleItem.find({ vendorId: id })
        res.status(200).send({
            message: "Orders fetched Successfully",
            order: allData,
        });
    } catch (err) {
        console.log(err,"ERR");
        
        res.status(500).send({ message: err.message });
    }
}

module.exports = {
    createSaleItemOrder,
    getSaleItemHistory
}