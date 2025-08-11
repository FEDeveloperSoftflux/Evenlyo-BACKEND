const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');

// Get available issue categories
const getIssueCategories = (req, res) => {
  try {
    const categories = [
      'Account Issues',
      'Booking Problems', 
      'Payment Issues',
      'Technical Support',
      'Service Quality',
      'Refund Request',
      'General Inquiry',
      'Other'
    ];

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching issue categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch issue categories'
    });
  }
};

// Create a new support ticket
const createSupportTicket = async (req, res) => {
  try {
    const { issueRelatedTo, details } = req.body;

    // Validate required fields
    if (!issueRelatedTo || !details) {
      return res.status(400).json({
        success: false,
        message: 'Issue category and details are required'
      });
    }

    // Validate details length
    if (details.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Details must be at least 10 characters long'
      });
    }

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
      issueRelatedTo,
      details: details.trim()
    });

    await supportTicket.save();

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: {
        ticketId: supportTicket.ticketId,
        issueRelatedTo: supportTicket.issueRelatedTo,
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

;

module.exports = {
  getIssueCategories,
  createSupportTicket,
};