const express = require('express');
const router = express.Router();
const adminSupportController = require('../../controllers/admin/supportController');

// GET all support tickets for admin
router.get('/support-tickets', adminSupportController.getAllSupportTickets);

// PATCH toggle status of a support ticket
router.patch('/ticket-status/:ticketId', adminSupportController.toggleTicketStatus);

// POST send email to support ticket user
router.post('/send-email/:ticketId', adminSupportController.sendEmailToTicketUser);

module.exports = router;
