const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Listing = require('../models/Listing');
const asyncHandler = require('express-async-handler');

// @desc    Get vendor profile (public and private access)
// @route   GET /api/vendor/profile/:vendorId (public)
// @route   GET /api/vendor/profile (private)
// @access  Public/Private
const getVendorProfile = asyncHandler(async (req, res) => {
  const vendorId = req.params.vendorId || req.user?.id;
  
  let vendor;
  if (req.params.vendorId) {
    // Public access to vendor profile by vendor ID
    vendor = await Vendor.findById(vendorId)
      .populate('userId', 'firstName lastName email profileImage isActive')
      .populate('mainCategories', 'name icon description')
      .populate('subCategories', 'name icon description');
  } else {
    // Private access for authenticated vendor
    vendor = await Vendor.findOne({ userId: req.user.id })
      .populate('userId', 'firstName lastName email contactNumber address profileImage isActive')
      .populate('mainCategories', 'name icon description')
      .populate('subCategories', 'name icon description');
  }

  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor profile not found'
    });
  }

  // For public access, filter out private information
  const isPublicAccess = !!req.params.vendorId;
  
  const profileData = {
    _id: vendor._id,
    businessInfo: {
      businessName: vendor.businessName,
      businessEmail: isPublicAccess ? undefined : vendor.businessEmail,
      businessPhone: isPublicAccess ? undefined : vendor.businessPhone,
      businessAddress: vendor.businessAddress,
      businessWebsite: vendor.businessWebsite,
      businessLocation: vendor.businessLocation,
      businessDescription: vendor.businessDescription
    },
    teamInfo: {
      teamType: vendor.teamType,
      teamSize: vendor.teamSize
    },
    media: {
      businessLogo: vendor.businessLogo,
      bannerImage: vendor.bannerImage,
      gallery: vendor.gallery
    },
    categories: {
      mainCategories: vendor.mainCategories,
      subCategories: vendor.subCategories
    },
    performance: {
      rating: vendor.rating,
      totalBookings: vendor.totalBookings,
      completedBookings: vendor.completedBookings,
      completionRate: vendor.totalBookings > 0 ? 
        ((vendor.completedBookings / vendor.totalBookings) * 100).toFixed(1) : 0
    },
    status: {
      isApproved: vendor.isApproved,
      approvalStatus: vendor.approvalStatus,
      rejectionReason: isPublicAccess ? undefined : vendor.rejectionReason
    },
    settings: {
      contactMeEnabled: vendor.contactMeEnabled
    },
    personalInfo: isPublicAccess ? {
      firstName: vendor.userId?.firstName,
      lastName: vendor.userId?.lastName,
      profileImage: vendor.userId?.profileImage
    } : {
      firstName: vendor.userId?.firstName,
      lastName: vendor.userId?.lastName,
      email: vendor.userId?.email,
      contactNumber: vendor.userId?.contactNumber,
      address: vendor.userId?.address,
      profileImage: vendor.userId?.profileImage,
      isActive: vendor.userId?.isActive
    },
    timestamps: {
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt
    }
  };

  // Remove undefined fields for public access
  if (isPublicAccess) {
    profileData.businessInfo = Object.fromEntries(
      Object.entries(profileData.businessInfo).filter(([_, v]) => v !== undefined)
    );
    profileData.status = Object.fromEntries(
      Object.entries(profileData.status).filter(([_, v]) => v !== undefined)
    );
  }

  res.json({
    success: true,
    data: profileData
  });
});

// @desc    Update vendor profile
// @route   PUT /api/vendor/profile
// @access  Private (Vendor)
const updateVendorProfile = asyncHandler(async (req, res) => {
  const {
    businessName,
    businessEmail,
    businessPhone,
    businessAddress,
    businessWebsite,
    teamType,
    teamSize,
    businessLocation,
    businessDescription,
    businessLogo,
    bannerImage,
    gallery,
    mainCategories,
    subCategories,
    contactMeEnabled
  } = req.body;

  // Find vendor profile
  const vendor = await Vendor.findOne({ userId: req.user.id });
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor profile not found'
    });
  }

  // Update fields if provided
  if (businessName) vendor.businessName = businessName;
  if (businessEmail) vendor.businessEmail = businessEmail;
  if (businessPhone) vendor.businessPhone = businessPhone;
  if (businessAddress) vendor.businessAddress = businessAddress;
  if (businessWebsite) vendor.businessWebsite = businessWebsite;
  if (teamType) vendor.teamType = teamType;
  if (teamSize) vendor.teamSize = teamSize;
  if (businessLocation) vendor.businessLocation = businessLocation;
  if (businessDescription) vendor.businessDescription = businessDescription;
  if (businessLogo) vendor.businessLogo = businessLogo;
  if (bannerImage) vendor.bannerImage = bannerImage;
  if (gallery) vendor.gallery = gallery;
  if (mainCategories) vendor.mainCategories = mainCategories;
  if (subCategories) vendor.subCategories = subCategories;
  if (typeof contactMeEnabled === 'boolean') vendor.contactMeEnabled = contactMeEnabled;

  await vendor.save();

  // Return updated profile
  const updatedVendor = await Vendor.findById(vendor._id)
    .populate('userId', 'firstName lastName email contactNumber address profileImage')
    .populate('mainCategories', 'name icon description')
    .populate('subCategories', 'name icon description');

  res.json({
    success: true,
    message: 'Vendor profile updated successfully',
    data: updatedVendor
  });
});

// @desc    Get vendor business details and analytics
// @route   GET /api/vendor/business-details
// @access  Private (Vendor)
const getVendorBusinessDetails = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ userId: req.user.id })
    .populate('userId', 'firstName lastName email contactNumber address profileImage')
    .populate('mainCategories', 'name icon description')
    .populate('subCategories', 'name icon description');

  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor profile not found'
    });
  }

  // Get listings count
  const listingsCount = await Listing.countDocuments({ vendor: vendor._id });
  const activeListingsCount = await Listing.countDocuments({ 
    vendor: vendor._id, 
    status: 'active',
    isActive: true 
  });

  // Get average listing price
  const listings = await Listing.find({ vendor: vendor._id }, 'pricing.amount');
  const averagePrice = listings.length > 0 
    ? listings.reduce((sum, listing) => sum + (listing.pricing?.amount || 0), 0) / listings.length
    : 0;

  const businessDetails = {
    profile: {
      _id: vendor._id,
      businessName: vendor.businessName,
      businessEmail: vendor.businessEmail,
      businessPhone: vendor.businessPhone,
      businessAddress: vendor.businessAddress,
      businessWebsite: vendor.businessWebsite,
      businessLocation: vendor.businessLocation,
      businessDescription: vendor.businessDescription
    },
    team: {
      teamType: vendor.teamType,
      teamSize: vendor.teamSize
    },
    media: {
      businessLogo: vendor.businessLogo,
      bannerImage: vendor.bannerImage,
      gallery: vendor.gallery
    },
    categories: {
      mainCategories: vendor.mainCategories,
      subCategories: vendor.subCategories
    },
    performance: {
      rating: vendor.rating,
      totalBookings: vendor.totalBookings,
      completedBookings: vendor.completedBookings,
      completionRate: vendor.totalBookings > 0 ? 
        ((vendor.completedBookings / vendor.totalBookings) * 100).toFixed(1) : 0
    },
    listings: {
      total: listingsCount,
      active: activeListingsCount,
      averagePrice: Math.round(averagePrice)
    },
    status: {
      isApproved: vendor.isApproved,
      approvalStatus: vendor.approvalStatus,
      rejectionReason: vendor.rejectionReason
    },
    settings: {
      contactMeEnabled: vendor.contactMeEnabled
    },
    owner: {
      firstName: vendor.userId?.firstName,
      lastName: vendor.userId?.lastName,
      email: vendor.userId?.email,
      contactNumber: vendor.userId?.contactNumber,
      address: vendor.userId?.address,
      profileImage: vendor.userId?.profileImage
    },
    timestamps: {
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt
    }
  };

  res.json({
    success: true,
    data: businessDetails
  });
});

// @desc    Get vendor dashboard stats
// @route   GET /api/vendor/dashboard
// @access  Private (Vendor)
const getVendorDashboard = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ userId: req.user.id });
  
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor profile not found'
    });
  }

  // Get listings stats
  const totalListings = await Listing.countDocuments({ vendor: vendor._id });
  const activeListings = await Listing.countDocuments({ 
    vendor: vendor._id, 
    status: 'active',
    isActive: true 
  });
  const draftListings = await Listing.countDocuments({ 
    vendor: vendor._id, 
    status: 'draft' 
  });

  // Get recent listings
  const recentListings = await Listing.find({ vendor: vendor._id })
    .select('title featuredImage status createdAt pricing')
    .sort({ createdAt: -1 })
    .limit(5);

  const dashboardData = {
    vendor: {
      _id: vendor._id,
      businessName: vendor.businessName,
      approvalStatus: vendor.approvalStatus,
      isApproved: vendor.isApproved
    },
    stats: {
      listings: {
        total: totalListings,
        active: activeListings,
        draft: draftListings
      },
      bookings: {
        total: vendor.totalBookings,
        completed: vendor.completedBookings,
        completionRate: vendor.totalBookings > 0 ? 
          ((vendor.completedBookings / vendor.totalBookings) * 100).toFixed(1) : 0
      },
      rating: {
        average: vendor.rating.average,
        totalReviews: vendor.rating.totalReviews
      }
    },
    recentListings,
    timestamps: {
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt
    }
  };

  res.json({
    success: true,
    data: dashboardData
  });
});

// @desc    Get all vendors (admin/public listing)
// @route   GET /api/vendor/all
// @access  Public
const getAllVendors = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status = 'approved',
    category,
    location,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const query = {};
  
  // Filter by approval status
  if (status !== 'all') {
    query.approvalStatus = status;
  }

  // Filter by category
  if (category) {
    query.mainCategories = category;
  }

  // Filter by location
  if (location) {
    query.businessLocation = new RegExp(location, 'i');
  }

  const skip = (page - 1) * limit;
  
  // Build sort object
  const sortOptions = {};
  if (sortBy === 'rating') {
    sortOptions['rating.average'] = sortOrder === 'desc' ? -1 : 1;
  } else if (sortBy === 'bookings') {
    sortOptions['totalBookings'] = sortOrder === 'desc' ? -1 : 1;
  } else {
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
  }

  const vendors = await Vendor.find(query)
    .populate('userId', 'firstName lastName profileImage')
    .populate('mainCategories', 'name icon')
    .select('businessName businessLocation businessDescription businessLogo rating totalBookings completedBookings approvalStatus createdAt')
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Vendor.countDocuments(query);

  res.json({
    success: true,
    data: vendors,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      limit: parseInt(limit)
    }
  });
});

// @desc    Get featured vendors for homepage display
// @route   GET /api/vendor/featured
// @access  Public
const getFeaturedVendors = asyncHandler(async (req, res) => {
  const { 
    limit = 6,
    featured = false,
    category,
    location
  } = req.query;

  const query = {
    approvalStatus: 'approved'
    // Removed isApproved: true as it seems inconsistent with approvalStatus in your schema
  };

  // Filter by category
  if (category) {
    query.mainCategories = category;
  }

  // Filter by location
  if (location) {
    query.businessLocation = new RegExp(location, 'i');
  }

  console.log('Featured vendors query:', query); // Debug log

  // Sort by rating and total bookings for featured vendors
  const sortOptions = featured === 'true' 
    ? { 'rating.average': -1, 'totalBookings': -1 }
    : { createdAt: -1 };

  const vendors = await Vendor.find(query)
    .populate('userId', 'firstName lastName email profileImage isActive')
    .populate('mainCategories', 'name icon description')
    .populate('subCategories', 'name icon description')
    .select(`
      businessName 
      businessEmail
      businessPhone
      businessAddress
      businessLocation 
      businessDescription 
      businessLogo 
      bannerImage
      gallery
      businessWebsite
      teamType
      teamSize
      rating 
      totalBookings 
      completedBookings
      contactMeEnabled
      isApproved
      approvalStatus
      createdAt
      updatedAt
    `)
    .sort(sortOptions)
    .limit(parseInt(limit));

  console.log(`Found ${vendors.length} featured vendors`); // Debug log

  // Format data with comprehensive vendor profile and business details
  const formattedVendors = vendors.map(vendor => {
    // Create services array from categories
    const services = [
      ...vendor.mainCategories.map(cat => cat.name),
      ...vendor.subCategories.map(subCat => subCat.name)
    ];

    // Get business description in preferred language
    const description = typeof vendor.businessDescription === 'object' 
      ? vendor.businessDescription.en || vendor.businessDescription.nl || ''
      : vendor.businessDescription || '';

    return {
      _id: vendor._id,
      // Business Profile Information
      businessInfo: {
        businessName: vendor.businessName,
        businessEmail: vendor.businessEmail,
        businessPhone: vendor.businessPhone,
        businessAddress: vendor.businessAddress,
        businessWebsite: vendor.businessWebsite,
        businessLocation: vendor.businessLocation,
        businessDescription: description,
        shortDescription: description.length > 150 ? description.substring(0, 150) + '...' : description
      },
      // Team Information
      teamInfo: {
        teamType: vendor.teamType,
        teamSize: vendor.teamSize
      },
      // Media Assets
      media: {
        businessLogo: vendor.businessLogo,
        bannerImage: vendor.bannerImage,
        gallery: vendor.gallery,
        ownerImage: vendor.userId?.profileImage
      },
      // Categories and Services
      categories: {
        mainCategories: vendor.mainCategories,
        subCategories: vendor.subCategories,
        services: services,
        displayServices: services.slice(0, 4) // Limited for card display
      },
      // Performance Metrics
      performance: {
        rating: {
          average: vendor.rating?.average || 0,
          totalReviews: vendor.rating?.totalReviews || 0,
          stars: Math.round(vendor.rating?.average || 0)
        },
        bookings: {
          total: vendor.totalBookings || 0,
          completed: vendor.completedBookings || 0,
          completionRate: vendor.totalBookings > 0 
            ? ((vendor.completedBookings / vendor.totalBookings) * 100).toFixed(1)
            : 0
        }
      },
      // Contact Information
      contact: {
        phone: vendor.businessPhone,
        email: vendor.businessEmail,
        website: vendor.businessWebsite,
        contactEnabled: vendor.contactMeEnabled,
        canContact: vendor.contactMeEnabled && vendor.approvalStatus === 'approved'
      },
      // Owner/Personal Information
      personalInfo: {
        firstName: vendor.userId?.firstName,
        lastName: vendor.userId?.lastName,
        fullName: vendor.userId ? `${vendor.userId.firstName} ${vendor.userId.lastName}` : '',
        profileImage: vendor.userId?.profileImage,
        isActive: vendor.userId?.isActive
      },
      // Status and Verification
      status: {
        isApproved: vendor.isApproved,
        approvalStatus: vendor.approvalStatus,
        isVerified: vendor.approvalStatus === 'approved',
        isActive: vendor.userId?.isActive
      },
      // Settings
      settings: {
        contactMeEnabled: vendor.contactMeEnabled
      },
      // Additional Display Properties
      display: {
        availability: 'AVAILABLE', // You can add logic to determine actual availability
        featured: true,
        whyChooseUs: description.length > 100 ? description.substring(0, 100) + '...' : description,
        cardTitle: vendor.businessName,
        cardSubtitle: vendor.businessLocation
      },
      // Timestamps
      timestamps: {
        joinedDate: vendor.createdAt,
        createdAt: vendor.createdAt,
        updatedAt: vendor.updatedAt
      }
    };
  });

  res.json({
    success: true,
    data: formattedVendors,
    count: formattedVendors.length
  });
});

// @desc    Get vendors by category and subcategory
// @route   GET /api/vendor/by-category
// @access  Public
const getVendorsByCategory = asyncHandler(async (req, res) => {
  const { 
    category,
    subcategory,
    page = 1, 
    limit = 10,
    sortBy = 'rating',
    sortOrder = 'desc'
  } = req.query;

  // Build query object
  const query = {
    approvalStatus: 'approved'
  };

  // Filter by main category
  if (category) {
    query.mainCategories = category;
  }

  // Filter by subcategory
  if (subcategory) {
    query.subCategories = subcategory;
  }

  const skip = (page - 1) * limit;
  
  // Build sort object
  const sortOptions = {};
  if (sortBy === 'rating') {
    sortOptions['rating.average'] = sortOrder === 'desc' ? -1 : 1;
  } else if (sortBy === 'bookings') {
    sortOptions['totalBookings'] = sortOrder === 'desc' ? -1 : 1;
  } else if (sortBy === 'name') {
    sortOptions['businessName'] = sortOrder === 'desc' ? -1 : 1;
  } else {
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
  }

  const vendors = await Vendor.find(query)
    .populate('userId', 'firstName lastName profileImage isActive')
    .populate('mainCategories', 'name icon description')
    .populate('subCategories', 'name icon description')
    .select(`
      businessName 
      businessEmail
      businessDescription 
      businessLogo 
      rating 
      totalBookings 
      completedBookings
      contactMeEnabled
      approvalStatus
      createdAt
    `)
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Vendor.countDocuments(query);

  // Format data with requested information
  const formattedVendors = vendors.map(vendor => {
    // Get business description in preferred language
    const description = typeof vendor.businessDescription === 'object' 
      ? vendor.businessDescription.en || vendor.businessDescription.nl || ''
      : vendor.businessDescription || '';

    return {
      _id: vendor._id,
      businessName: vendor.businessName,
      rating: {
        stars: Math.round(vendor.rating?.average || 0),
        average: vendor.rating?.average || 0,
        totalReviews: vendor.rating?.totalReviews || 0
      },
      availability: vendor.contactMeEnabled && vendor.approvalStatus === 'approved' ? 'AVAILABLE' : 'UNAVAILABLE',
      whyChooseUs: description.length > 100 ? description.substring(0, 100) + '...' : description,
      businessEmail: vendor.businessEmail,
      businessDescription: description
    };
  });

  res.json({
    success: true,
    data: formattedVendors,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      limit: parseInt(limit)
    },
    filters: {
      category: category || null,
      subcategory: subcategory || null,
      sortBy,
      sortOrder
    }
  });
});

module.exports = {
  getVendorProfile,
  updateVendorProfile,
  getVendorBusinessDetails,
  getVendorDashboard,
  getAllVendors,
  getFeaturedVendors,
  getVendorsByCategory
};
