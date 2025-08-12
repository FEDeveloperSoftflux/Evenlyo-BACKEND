const Listing = require('../models/Listing');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Vendor = require('../models/Vendor');
const BookingRequest = require('../models/Booking');

// @desc    Get available listings with filters
// @route   GET /api/listings
// @access  Public
const getAvailableListings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      categoryId,
      subCategoryId,
      search,
      minPrice,
      maxPrice,
      pricingType,
      city,
      sortBy = 'sortOrder',
      sortOrder = 'desc',
      status = 'active',
      isFeatured,
      isAvailable
    } = req.query;

    // Build query object
    const query = {
      status: status,
      isActive: true
    };

    // Filter by category
    if (categoryId) {
      query.category = categoryId;
    }

    // Filter by subcategory
    if (subCategoryId) {
      query.subCategory = subCategoryId;
    }

    // Filter by city
    if (city) {
      query['location.city'] = { $regex: city, $options: 'i' };
    }

    // Search by title, description, or tags
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Filter by price range (check all pricing options)
    if (minPrice || maxPrice) {
      const priceQuery = { $or: [] };
      
      if (minPrice) {
        priceQuery.$or.push(
          { 'pricing.perHour': { $gte: parseFloat(minPrice) } },
          { 'pricing.perDay': { $gte: parseFloat(minPrice) } },
          { 'pricing.perEvent': { $gte: parseFloat(minPrice) } }
        );
      }
      
      if (maxPrice) {
        priceQuery.$or.push(
          { 'pricing.perHour': { $lte: parseFloat(maxPrice) } },
          { 'pricing.perDay': { $lte: parseFloat(maxPrice) } },
          { 'pricing.perEvent': { $lte: parseFloat(maxPrice) } }
        );
      }
      
      if (priceQuery.$or.length > 0) {
        query.$and = query.$and || [];
        query.$and.push(priceQuery);
      }
    }

    // Filter by pricing type
    if (pricingType) {
      query['pricing.type'] = pricingType;
    }

    // Filter by featured status
    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true';
    }

    // Filter by availability
    if (isAvailable !== undefined) {
      query['availability.isAvailable'] = isAvailable === 'true';
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sortOptions = {};
    if (sortBy === 'price') {
      // Sort by lowest available price option
      sortOptions['pricing.perHour'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'rating') {
      sortOptions['ratings.average'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'popularity') {
      sortOptions['bookings.completed'] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    // Get listings with populated vendor and category information
    const listings = await Listing.find(query)
      .populate('vendor', '_id businessName businessLocation userId')
      .populate('category', 'name icon')
      .populate('subCategory', 'name icon')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-seo -__v -contact.email -contact.phone'); // Hide contact info in list view

    // Get total count for pagination
    const total = await Listing.countDocuments(query);

    res.json({
      success: true,
      data: listings,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching listings',
      error: error.message
    });
  }
};

// @desc    Get listing by ID with full details
// @route   GET /api/listings/:id
// @access  Public
const getListingById = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('vendor', '_id businessName businessLocation businessDescription businessEmail businessPhone businessWebsite gallery userId')
      .populate('category', 'name icon description')
      .populate('subCategory', 'name icon description');

    if (!listing || !listing.isActive || listing.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Increment view count
    listing.views += 1;
    await listing.save();

    // Include contact information for detailed view
    res.json({
      success: true,
      data: listing
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error fetching listing',
      error: error.message
    });
  }
};

// @desc    Get featured listings
// @route   GET /api/listings/featured
// @access  Public
const getFeaturedListings = async (req, res) => {
  try {
    const { limit = 6, categoryId } = req.query;

    const query = {
      isFeatured: true,
      status: 'active',
      isActive: true,
      'availability.isAvailable': true
    };

    // Filter by category if provided
    if (categoryId) {
      query.category = categoryId;
    }

    const listings = await Listing.find(query)
      .populate('vendor', '_id businessName businessLocation')
      .populate('category', 'name icon')
      .populate('subCategory', 'name icon')
      .sort({ 'ratings.average': -1, 'bookings.completed': -1, sortOrder: -1 })
      .limit(parseInt(limit))
      .select('-seo -__v');

    res.json({
      success: true,
      data: listings
    });
  } catch (error) {
    console.error('Error fetching featured listings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured listings',
      error: error.message
    });
  }
};

// @desc    Get popular listings
// @route   GET /api/listings/popular
// @access  Public
const getPopularListings = async (req, res) => {
  try {
    const { limit = 8, categoryId } = req.query;

    const query = {
      status: 'active',
      isActive: true,
      'availability.isAvailable': true
    };

    // Filter by category if provided
    if (categoryId) {
      query.category = categoryId;
    }

    const listings = await Listing.find(query)
      .populate('vendor', '_id businessName businessLocation')
      .populate('category', 'name icon')
      .populate('subCategory', 'name icon')
      .sort({ 'bookings.completed': -1, views: -1, 'ratings.average': -1 })
      .limit(parseInt(limit))
      .select('-seo -__v');

    res.json({
      success: true,
      data: listings
    });
  } catch (error) {
    console.error('Error fetching popular listings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular listings',
      error: error.message
    });
  }
};


// Utility: Update 'popular' field for all listings based on criteria
// Criteria: completed bookings > 10 and average rating > 4.5
const updatePopularListings = async (req, res) => {
  try {
    const listings = await Listing.find();
    let updatedCount = 0;
    for (const listing of listings) {
      const isPopular = (listing.bookings && listing.bookings.completed > 10) && (listing.ratings && listing.ratings.average >= 4.5);
      if (listing.popular !== isPopular) {
        listing.popular = isPopular;
        await listing.save();
        updatedCount++;
      }
    }
    if (res) {
      res.json({ success: true, message: `Updated ${updatedCount} listings' popular status.` });
    }
    return updatedCount;
  } catch (error) {
    if (res) {
      res.status(500).json({ success: false, message: 'Error updating popular status', error: error.message });
    }
    throw error;
  }
};

// Optionally, you can expose this as an admin route or call it on a schedule.

// @desc    Search listings with advanced filters
// @route   GET /api/listings/search
// @access  Public
const searchListings = async (req, res) => {
  try {
    const {
      q, // search query
      page = 1,
      limit = 12,
      categoryId,
      subCategoryId,
      city,
      minPrice,
      maxPrice,
      pricingType,
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const query = {
      status: 'active',
      isActive: true,
      'availability.isAvailable': true,
      $text: { $search: q }
    };

    // Apply filters
    if (categoryId) query.category = categoryId;
    if (subCategoryId) query.subCategory = subCategoryId;
    if (city) query['location.city'] = { $regex: city, $options: 'i' };
    if (pricingType) query['pricing.type'] = pricingType;

    // Price range filter
    if (minPrice || maxPrice) {
      query['pricing.amount'] = {};
      if (minPrice) query['pricing.amount'].$gte = parseFloat(minPrice);
      if (maxPrice) query['pricing.amount'].$lte = parseFloat(maxPrice);
    }

    const skip = (page - 1) * limit;

    // Build sort object
    const sortOptions = {};
    if (sortBy === 'relevance') {
      sortOptions.score = { $meta: 'textScore' };
    } else if (sortBy === 'price') {
      sortOptions['pricing.amount'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'rating') {
      sortOptions['ratings.average'] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    const listings = await Listing.find(query)
      .populate('vendor', '_id businessName businessLocation')
      .populate('category', 'name icon')
      .populate('subCategory', 'name icon')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-seo -__v');

    const total = await Listing.countDocuments(query);

    res.json({
      success: true,
      data: listings,
      searchQuery: q,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error searching listings:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching listings',
      error: error.message
    });
  }
};

// @desc    Get listings by vendor ID
// @route   GET /api/listings/vendor/:vendorId
// @access  Public
const getListingsByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 12, sortBy = 'createdAt', sortOrder = 'desc', status = 'active' } = req.query;

    // Verify vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const query = {
      vendor: vendorId,
      isActive: true
    };

    // Add status filter
    if (status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    
    // Build sort object
    const sortOptions = {};
    if (sortBy === 'price') {
      sortOptions['pricing.amount'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'rating') {
      sortOptions['ratings.average'] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    const listings = await Listing.find(query)
      .populate('category', 'name icon')
      .populate('subCategory', 'name icon')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-seo -__v');

    const total = await Listing.countDocuments(query);

    res.json({
      success: true,
      data: listings,
      vendor: {
        _id: vendor._id,
        businessName: vendor.businessName,
        businessLocation: vendor.businessLocation
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching listings by vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching listings by vendor',
      error: error.message
    });
  }
};

// @desc    Get listings by service type (human vs non-human)
// @route   GET /api/listings/service-type/:type
// @access  Public
const getListingsByServiceType = async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 12, sortBy = 'sortOrder', sortOrder = 'desc' } = req.query;

    if (!['human', 'non_human'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service type. Must be "human" or "non_human"'
      });
    }

    const query = {
      'serviceDetails.serviceType': type,
      status: 'active',
      isActive: true,
      'availability.isAvailable': true
    };

    const skip = (page - 1) * limit;
    
    const sortOptions = {};
    if (sortBy === 'price') {
      sortOptions['pricing.perHour'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'rating') {
      sortOptions['ratings.average'] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    const listings = await Listing.find(query)
      .populate('vendor', '_id businessName businessLocation')
      .populate('category', 'name icon')
      .populate('subCategory', 'name icon')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-seo -__v');

    const total = await Listing.countDocuments(query);

    res.json({
      success: true,
      data: listings,
      serviceType: type,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching listings by service type:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching listings by service type',
      error: error.message
    });
  }
};

// @desc    Create a new listing
// @route   POST /api/listings
// @access  Private (Vendor only)
const createListing = async (req, res) => {
  try {
    const listingData = req.body;
    
    // Automatically set security fee based on service type
    if (listingData.serviceType === 'human') {
      if (listingData.pricing) {
        listingData.pricing.securityFee = 0;
      }
    } else if (listingData.serviceType === 'non_human') {
      if (listingData.pricing && (!listingData.pricing.securityFee || listingData.pricing.securityFee === 0)) {
        listingData.pricing.securityFee = 50; // Default security fee for equipment
      }
    }

    const listing = new Listing(listingData);
    await listing.save();

    // Populate the response
    const populatedListing = await Listing.findById(listing._id)
      .populate('vendor', '_id businessName businessLocation businessDescription businessEmail businessPhone businessWebsite gallery userId')
      .populate('category', 'name icon description')
      .populate('subCategory', 'name icon description');

    res.status(201).json({
      success: true,
      message: 'Listing created successfully',
      data: populatedListing
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating listing',
      error: error.message
    });
  }
};

// @desc    Update an existing listing
// @route   PUT /api/listings/:id
// @access  Private (Vendor only)
const updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Find the existing listing
    const existingListing = await Listing.findById(id);
    if (!existingListing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Automatically adjust security fee based on service type if it's being updated
    if (updateData.serviceType) {
      if (updateData.serviceType === 'human') {
        if (updateData.pricing) {
          updateData.pricing.securityFee = 0;
        } else {
          updateData.pricing = { ...existingListing.pricing.toObject(), securityFee: 0 };
        }
      } else if (updateData.serviceType === 'non_human') {
        if (updateData.pricing && (!updateData.pricing.securityFee || updateData.pricing.securityFee === 0)) {
          updateData.pricing.securityFee = 50; // Default security fee for equipment
        } else if (!updateData.pricing) {
          updateData.pricing = { ...existingListing.pricing.toObject() };
          if (!updateData.pricing.securityFee || updateData.pricing.securityFee === 0) {
            updateData.pricing.securityFee = 50;
          }
        }
      }
    }

    const updatedListing = await Listing.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('vendor', '_id businessName businessLocation businessDescription businessEmail businessPhone businessWebsite gallery userId')
      .populate('category', 'name icon description')
      .populate('subCategory', 'name icon description');

    res.json({
      success: true,
      message: 'Listing updated successfully',
      data: updatedListing
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating listing',
      error: error.message
    });
  }
};

// @desc    Check listing availability for date range (enhanced for multi-day)
// @route   GET /api/listing/:id/availability
// @access  Public
const checkListingAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { start, end, detailed = false } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Start and end dates are required'
      });
    }

    // Validate dates
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    // Check if listing exists and is active
    const listing = await Listing.findOne({
      _id: id,
      isActive: true,
      status: 'active'
    }).select('title pricing.multiDayDiscount');

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found or not available'
      });
    }

    // Normalize dates for accurate comparison
    const checkStart = new Date(startDate);
    checkStart.setHours(0, 0, 0, 0);
    
    const checkEnd = new Date(endDate);
    checkEnd.setHours(23, 59, 59, 999);

    // Check for overlapping bookings that are not rejected or cancelled
    const overlappingBookings = await BookingRequest.find({
      listingId: id,
      status: { $nin: ['rejected', 'cancelled'] },
      $or: [
        {
          'details.startDate': { $lte: checkEnd },
          'details.endDate': { $gte: checkStart }
        }
      ]
    }).select('details.startDate details.endDate status trackingId details.duration');

    const isAvailable = overlappingBookings.length === 0;
    
    // Calculate multi-day details
    const diffTime = Math.abs(checkEnd - checkStart);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const isMultiDay = diffDays > 1;

    let response = {
      success: true,
      data: {
        listingId: id,
        listingTitle: listing.title,
        requestedPeriod: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days: diffDays,
          isMultiDay: isMultiDay
        },
        isAvailable,
        conflictingBookings: overlappingBookings.map(booking => ({
          trackingId: booking.trackingId,
          startDate: booking.details.startDate,
          endDate: booking.details.endDate,
          status: booking.status,
          isMultiDay: booking.details.duration?.isMultiDay || false
        }))
      }
    };

    // Add multi-day discount info if applicable
    if (isMultiDay && listing.pricing?.multiDayDiscount?.enabled) {
      const discount = listing.pricing.multiDayDiscount;
      response.data.multiDayDiscount = {
        eligible: diffDays >= discount.minDays,
        percent: discount.percent,
        minDays: discount.minDays,
        description: discount.description
      };
    }

    // Detailed day-by-day availability if requested
    if (detailed === 'true' && isMultiDay) {
      const dailyAvailability = [];
      const currentDate = new Date(checkStart);
      
      for (let i = 0; i < diffDays; i++) {
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayConflicts = overlappingBookings.filter(booking => {
          const bookingStart = new Date(booking.details.startDate);
          const bookingEnd = new Date(booking.details.endDate);
          return bookingStart <= dayEnd && bookingEnd >= dayStart;
        });
        
        dailyAvailability.push({
          date: dayStart.toISOString().split('T')[0],
          available: dayConflicts.length === 0,
          conflicts: dayConflicts.length,
          conflictingBookings: dayConflicts.map(b => b.trackingId)
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      response.data.dailyAvailability = dailyAvailability;
    }

    res.json(response);

  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking availability'
    });
  }
};

// @desc    Filter listings by category or subcategory with essential details
// @route   GET /api/listings/filter
// @access  Public
const filterListings = async (req, res) => {
  try {
    const {
      categoryId,
      subCategoryId,
      page = 1,
      limit = 12,
      sortBy = 'ratings.average',
      sortOrder = 'desc'
    } = req.query;

    // Validate that at least one filter is provided
    if (!categoryId && !subCategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either categoryId or subCategoryId to filter listings'
      });
    }

    // Build query object
    const query = {
      status: 'active',
      isActive: true,
      'availability.isAvailable': true
    };

    // Filter by category AND/OR subcategory
    if (categoryId && subCategoryId) {
      // If both category and subcategory are provided, filter by both
      query.category = categoryId;
      query.subCategory = subCategoryId;
    } else if (subCategoryId) {
      // If only subcategory is provided
      query.subCategory = subCategoryId;
    } else if (categoryId) {
      // If only category is provided
      query.category = categoryId;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sortOptions = {};
    if (sortBy === 'price') {
      // Sort by pricing per event (most common)
      sortOptions['pricing.perEvent'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'rating') {
      sortOptions['ratings.average'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'popularity') {
      sortOptions['bookings.completed'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'newest') {
      sortOptions['createdAt'] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    // Get listings with essential information
    const listings = await Listing.find(query)
      .populate('vendor', 'businessName businessLocation rating')
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('title description pricing location ratings media.featuredImage');

    // Get total count for pagination
    const total = await Listing.countDocuments(query);

    // Format the response data
    const formattedListings = listings.map(listing => {
      // Get the main pricing (prefer per event, then per day, then per hour)
      let pricingPerEvent = null;
      if (listing.pricing.perEvent) {
        pricingPerEvent = `${listing.pricing.currency} ${listing.pricing.perEvent}`;
      } else if (listing.pricing.perDay) {
        pricingPerEvent = `${listing.pricing.currency} ${listing.pricing.perDay}/day`;
      } else if (listing.pricing.perHour) {
        pricingPerEvent = `${listing.pricing.currency} ${listing.pricing.perHour}/hour`;
      } else {
        pricingPerEvent = 'Quote on request';
      }

      return {
        id: listing._id,
        title: listing.title,
        description: listing.description,
        vendorName: listing.vendor?.businessName || 'Unknown Vendor',
        rating: listing.ratings?.average || 0,
        ratingCount: listing.ratings?.count || 0,
        pricingPerEvent,
        location: `${listing.location.city}${listing.location.region ? ', ' + listing.location.region : ''}`,
        featuredImage: listing.media?.featuredImage,
        category: listing.category?.name,
        subCategory: listing.subCategory?.name
      };
    });

    res.json({
      success: true,
      data: formattedListings,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      },
      filter: {
        categoryId: categoryId || null,
        subCategoryId: subCategoryId || null,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('Error filtering listings:', error);
    res.status(500).json({
      success: false,
      message: 'Error filtering listings',
      error: error.message
    });
  }
};

module.exports = {
  getAvailableListings,
  getListingById,
  getFeaturedListings,
  getPopularListings,
  searchListings,
  getListingsByVendor,
  getListingsByServiceType,
  createListing,
  updateListing,
  checkListingAvailability,
  filterListings
  ,updatePopularListings
}; 