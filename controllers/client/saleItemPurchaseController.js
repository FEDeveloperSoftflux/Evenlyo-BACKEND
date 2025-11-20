const SaleItem = require('../../models/SaleItemPurchase');
const mongoose = require('mongoose');


const createSaleItemOrder = async (req, res) => {
    try {
        let trackId = Math.floor(10000000 + Math.random() * 90000000).toString();
        console.log(trackId, req.user, "trackIdtrackIdtrackId");
        console.log(req.body, "req.bodyreq.bodyreq.body");

        const { vendorId, items, totalAmount, deliveryAmount } = req.body;
        if (!items || items.length === 0)
            return res.status(400).send({ message: "Items required" });
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
}

const getSaleItemHistory = async (req, res) => {
    try {
        const { id } = req.user
        const allData = await SaleItem.find({ customerId: id })
        res.status(200).send({
            message: "Order Created Successfully",
            order: allData,
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
}

module.exports = {
    createSaleItemOrder,
    getSaleItemHistory
}