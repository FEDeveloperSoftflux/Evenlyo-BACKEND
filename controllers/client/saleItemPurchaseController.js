const SaleItem = require('../../models/SaleItemPurchase');
const mongoose = require('mongoose');


const createSaleItemOrder = async (req, res) => {
    try {
        console.log("CAEE");
        const { vendorId, customerId, items } = req.body;
        if (!items || items.length === 0)
            return res.status(400).send({ message: "Items required" });
        const totalAmount = items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        const newOrder = await SaleItem.create({
            vendorId,
            customerId,
            items,
            totalAmount,
        });

        res.status(200).send({
            message: "Order Created Successfully",
            order: newOrder,
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
}

module.exports = {
    createSaleItemOrder
}