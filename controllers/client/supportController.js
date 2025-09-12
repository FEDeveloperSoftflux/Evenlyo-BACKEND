const SupportTicket = require('../../models/SupportTicket');
const User = require('../../models/User');


// Create a new support ticket
const createSupportTicket = async (req, res) => {
  try {
    // Accept payload in { data: { issueRelatedto, details } } format
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Payload must be in the format { data: { issueRelatedto, details } }'
      });
    }
    let { issueRelatedto, details } = data;
    // Trim values
    issueRelatedto = issueRelatedto ? issueRelatedto.trim() : '';
    details = details ? details.trim() : '';

    // Validate required fields
    if (!issueRelatedto || !details) {
      return res.status(400).json({
        success: false,
        message: 'Issue category and details are required'
      });
    }

    // Validate details length
    if (details.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Details must be at least 10 characters long'
      });
    }

  // ...existing code...

    // Get user info from session
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create support ticket
    const supportTicket = new SupportTicket({
      userEmail,
      userId,
      issueRelatedto,
      details
    });

    await supportTicket.save();

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: {
        ticketId: supportTicket.ticketId,
        issueRelatedto: supportTicket.issueRelatedto,
        details: supportTicket.details,
        status: supportTicket.status,
        createdAt: supportTicket.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create support ticket'
    });
  }
};
  
module.exports = {
  createSupportTicket,
};