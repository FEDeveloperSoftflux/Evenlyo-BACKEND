const Listing = require("../../models/Listing");
const SaleItem = require("../../models/Item");
const StockLog = require("../../models/StockLog");
const Booking = require("../../models/Booking");
const { toMultilingualText } = require("../../utils/textUtils");
const { createActivityLog } = require("../../utils/activityLogger");

const toggleListingStatus = async (req, res) => {
  try {
    const vendorId =
      req.vendor?._id || req.user?._id || req.user?.vendorId || req.user?.id;
    const listingId = req.params.id;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor not found in request.",
      });
    }

    // Find the listing and ensure it belongs to the vendor
    const listing = await Listing.findOne({ _id: listingId, vendor: vendorId });
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or not authorized",
      });
    }

    // Toggle the status (active/inactive)
    listing.status = listing.status === "active" ? "inactive" : "active";
    listing.isActive = listing.status === "active";
    await listing.save();

    res.json({
      success: true,
      message: `Listing status updated to ${listing.status}`,
      status: listing.status,
      isActive: listing.isActive,
    });
  } catch (err) {
    console.error("Toggle listing status error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

// GET /api/vendor/listings/overview
const getVendorListingsOverview = async (req, res) => {
  try {
    const vendorId =
      req.vendor?._id || req.user?._id || req.user?.vendorId || req.user?.id;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor not found in request.",
      });
    }

    // Get all listings for this vendor
    const listings = await Listing.find({ vendor: vendorId })
      .populate("category", "name")
      .populate("subCategory", "name");

    // Stats: unique main categories and subcategories
    const mainCategorySet = new Set();
    const subCategorySet = new Set();
    listings.forEach((listing) => {
      console.log(listing, "listinglistinglistinglisting");

      if (listing.category)
        mainCategorySet.add(listing.category._id.toString());
      if (listing.subCategory)
        subCategorySet.add(listing.subCategory._id.toString());
    });

    // Total number of listings
    const totalListings = listings.length;

    // Most booked listings (for bar chart)
    const bookings = await Booking.aggregate([
      { $match: { vendorId: vendorId } },
      { $group: { _id: "$listingId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Map booking counts to listingId
    const bookingCountMap = {};
    bookings.forEach((b) => {
      bookingCountMap[b._id?.toString()] = b.count;
    });

    // listingOverview: all listings with their booking count
    const listingOverview = listings.map((listing) => ({
      listingId: listing._id,
      title: listing.title?.en || listing.title,
      bookedCount: bookingCountMap[listing._id.toString()] || 0,
    }));

    // listingTable: all listings with required details
    // console.log(listings,"listingslistingslistings");

    const listingTable = listings.map(listing => ({
      ...listing.toObject(),
      listingId: listing._id,
      image: listing.images[0] || '',
      title: listing.title?.en || listing.title,
      description: listing.description?.en || listing.description,
      category: listing.category?.name?.en || '',
      subCategory: listing.subCategory?.name?.en || '',
      pricing: listing.pricing,
      date: listing.createdAt,
      status: listing.status,
    }));

    const uniqueCategories = await Listing.distinct("category");
    console.log(uniqueCategories, "uniqueCategoriesuniqueCategoriesuniqueCategories");

    res.json({
      success: true,
      stats: {
        totalMainCategories: uniqueCategories.length,
        totalSubCategories: subCategorySet.size,
        totalListings
      },
      listingOverview,
      listingTable
    });
  } catch (err) {
    console.error('Vendor listing overview error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// @desc    Create a new listing
// @route   POST /api/listings
// @access  Private (Vendor only)
// ...existing code...
const createListing = async (req, res) => {
  try {
    const listingData = req.body;

    // Validate required fields before processing
    if (
      !listingData.title ||
      (typeof listingData.title === "string" && !listingData.title.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: ["Title is required"],
      });
    }

    if (
      !listingData.description ||
      (typeof listingData.description === "string" &&
        !listingData.description.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: ["Description is required"],
      });
    }

    // Convert text fields to multilingual format using toMultilingualText
    listingData.title = toMultilingualText(listingData.title);
    listingData.description = toMultilingualText(listingData.description);

    // Handle optional fields
    if (listingData.subtitle) {
      listingData.subtitle = toMultilingualText(listingData.subtitle);
    }

    // Set vendor ID from authenticated user
    const vendorId =
      req.vendor?._id || req.user?._id || req.user?.vendorId || req.user?.id;
    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor not found in request.",
      });
    }

    // If vendor is not set in the listing data, set it from the authenticated user
    if (!listingData.vendor) {
      listingData.vendor = vendorId;
    }

    // Handle images array
    if (Array.isArray(listingData.images)) {
      listingData.images = listingData.images.filter(
        (img) => typeof img === "string" && img.length > 0
      );
    } else if (listingData.images && typeof listingData.images === "string") {
      listingData.images = [listingData.images];
    }
    // Fallback: if images is missing or empty, but media.gallery exists, copy gallery to images
    if (
      (!listingData.images || listingData.images.length === 0) &&
      listingData.media &&
      Array.isArray(listingData.media.gallery)
    ) {
      listingData.images = listingData.media.gallery.filter(
        (img) => typeof img === "string" && img.length > 0
      );
    }

    // Handle location coordinates - support both lat/lng and latitude/longitude formats
    if (listingData.location && listingData.location.coordinates) {
      const coords = listingData.location.coordinates;

      // Extract latitude and longitude, handling both formats
      let latitude =
        coords.latitude !== undefined ? coords.latitude : coords.lat;
      let longitude =
        coords.longitude !== undefined ? coords.longitude : coords.lng;

      // Validate latitude
      if (latitude !== undefined) {
        latitude = parseFloat(latitude);
        if (isNaN(latitude) || latitude < -90 || latitude > 90) {
          return res.status(400).json({
            success: false,
            message: "Invalid latitude: must be a number between -90 and 90",
          });
        }
      }

      // Validate longitude
      if (longitude !== undefined) {
        longitude = parseFloat(longitude);
        if (isNaN(longitude) || longitude < -180 || longitude > 180) {
          return res.status(400).json({
            success: false,
            message: "Invalid longitude: must be a number between -180 and 180",
          });
        }
      }

      // Set the coordinates in the correct format for the model
      if (latitude !== undefined && longitude !== undefined) {
        listingData.location.coordinates = {
          latitude: latitude,
          longitude: longitude,
        };
      }
    }

    // Automatically set security fee based on service type
    const serviceType =
      listingData.serviceDetails?.serviceType || listingData.serviceType;
    if (serviceType === "human") {
      if (listingData.pricing) {
        listingData.pricing.securityFee = 0;
      }
    } else if (serviceType === "non_human") {
      if (
        listingData.pricing &&
        (!listingData.pricing.securityFee ||
          listingData.pricing.securityFee === 0)
      ) {
        listingData.pricing.securityFee = 50; // Default security fee for equipment
      }
    }

    console.log("listingData", listingData);
    const listing = new Listing(listingData);
    await listing.save();

    // Create an initial stock log entry so listing creation is reflected in stock management
    try {
      const qty =
        typeof listing.quantity === "number"
          ? listing.quantity
          : Number(listing.quantity) || 0;
      await StockLog.create({
        listing: listing._id,
        type: "stockin",
        quantity: qty,
        note: "Initial stock recorded when listing was created",
        createdBy: req.user?._id,
      });
    } catch (e) {
      // Non-fatal: log but don't fail listing creation
      console.error(
        "Failed to create initial stock log for listing",
        listing._id,
        e
      );
    }

    // Populate the response
    const populatedListing = await Listing.findById(listing._id)
      .populate(
        "vendor",
        "_id businessName businessLocation businessDescription businessEmail businessPhone businessWebsite gallery userId"
      )
      .populate("category", "name icon description")
      .populate("subCategory", "name icon description");

    let activityLog = await createActivityLog({
      heading: "New Listing Created",
      type: "booking_created",
      description: `Created a new listing: "${listingData?.title?.en || listingData?.title
        }"`,
      vendorId,
    });
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
// ...existing code...

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
        message: "Listing not found",
      });
    }

    // Validate required fields if they are being updated
    if (updateData.title !== undefined) {
      if (
        !updateData.title ||
        (typeof updateData.title === "string" && !updateData.title.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: ["Title cannot be empty"],
        });
      }
      updateData.title = toMultilingualText(updateData.title);
    }

    if (updateData.description !== undefined) {
      if (
        !updateData.description ||
        (typeof updateData.description === "string" &&
          !updateData.description.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: ["Description cannot be empty"],
        });
      }
      updateData.description = toMultilingualText(updateData.description);
    }

    // Convert text fields to multilingual format using toMultilingualText
    if (updateData.subtitle) {
      updateData.subtitle = toMultilingualText(updateData.subtitle);
    }

    // Handle images array
    if (Array.isArray(updateData.images)) {
      updateData.images = updateData.images.filter(
        (img) => typeof img === "string" && img.length > 0
      );
    } else if (updateData.images && typeof updateData.images === "string") {
      updateData.images = [updateData.images];
    }
    // Fallback: if images is missing or empty, but media.gallery exists, copy gallery to images
    if (
      (!updateData.images || updateData.images.length === 0) &&
      updateData.media &&
      Array.isArray(updateData.media.gallery)
    ) {
      updateData.images = updateData.media.gallery.filter(
        (img) => typeof img === "string" && img.length > 0
      );
    }

    // Handle location coordinates - support both lat/lng and latitude/longitude formats
    if (updateData.location && updateData.location.coordinates) {
      const coords = updateData.location.coordinates;

      // Extract latitude and longitude, handling both formats
      let latitude =
        coords.latitude !== undefined ? coords.latitude : coords.lat;
      let longitude =
        coords.longitude !== undefined ? coords.longitude : coords.lng;

      // Validate latitude
      if (latitude !== undefined) {
        latitude = parseFloat(latitude);
        if (isNaN(latitude) || latitude < -90 || latitude > 90) {
          return res.status(400).json({
            success: false,
            message: "Invalid latitude: must be a number between -90 and 90",
          });
        }
      }

      // Validate longitude
      if (longitude !== undefined) {
        longitude = parseFloat(longitude);
        if (isNaN(longitude) || longitude < -180 || longitude > 180) {
          return res.status(400).json({
            success: false,
            message: "Invalid longitude: must be a number between -180 and 180",
          });
        }
      }

      // Set the coordinates in the correct format for the model
      if (latitude !== undefined && longitude !== undefined) {
        updateData.location.coordinates = {
          latitude: latitude,
          longitude: longitude,
        };
      }
    }

    // --- Merge pricing updates with existing pricing ---
    if (updateData.pricing) {
      const {
        type,
        amount,
        extratimeCost,
        securityFee,
        pricePerKm,
        escrowFee,
      } = updateData.pricing;

      // Get existing pricing to preserve unmodified fields
      const existingPricing = existingListing.pricing || {};

      // Merge existing pricing with updates, only updating provided fields
      updateData.pricing = {
        type: type !== undefined ? type : existingPricing.type,
        amount: amount !== undefined ? amount : existingPricing.amount,
        extratimeCost:
          extratimeCost !== undefined
            ? extratimeCost
            : existingPricing.extratimeCost,
        securityFee:
          securityFee !== undefined ? securityFee : existingPricing.securityFee,
        pricePerKm:
          pricePerKm !== undefined ? pricePerKm : existingPricing.pricePerKm,
        escrowFee:
          escrowFee !== undefined ? escrowFee : existingPricing.escrowFee,
      };

      // Validate required fields after merging
      if (!updateData.pricing.type || updateData.pricing.amount === undefined) {
        return res.status(400).json({
          success: false,
          message: "Pricing type and amount are required.",
        });
      }

      // Calculate totalPrice after merging pricing updates
      const finalAmount = updateData.pricing.amount || 0;
      const finalExtratimeCost = updateData.pricing.extratimeCost || 0;
      const finalSecurityFee = updateData.pricing.securityFee || 0;
      const finalEscrowFee = updateData.pricing.escrowFee || 0;
      updateData.pricing.totalPrice =
        finalAmount + finalExtratimeCost + finalSecurityFee + finalEscrowFee;
    }

    // Update the listing and trigger middleware
    const updatedListing = await Listing.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate(
        "vendor",
        "_id businessName businessLocation businessDescription businessEmail businessPhone businessWebsite gallery userId"
      )
      .populate("category", "name icon description")
      .populate("subCategory", "name icon description");

    res.json({
      success: true,
      message: "Listing updated successfully",
      data: updatedListing,
    });
  } catch (error) {
    console.error("Error updating listing:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Error updating listing",
      error: error.message,
    });
  }
};
// @desc    Delete a listing
// @route   DELETE /api/vendor/listings/:id
// @access  Private (Vendor only)
const deleteListing = async (req, res) => {
  try {
    const vendorId =
      req.vendor?._id || req.user?._id || req.user?.vendorId || req.user?.id;
    const listingId = req.params.id;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor not found in request.",
      });
    }

    // Find the listing and ensure it belongs to the vendor
    const listing = await Listing.findOne({ _id: listingId, vendor: vendorId });
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or not authorized",
      });
    }

    await Listing.deleteOne({ _id: listingId });

    res.json({
      success: true,
      message: "Listing deleted successfully",
    });
  } catch (err) {
    console.error("Delete listing error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

// @desc    Get vendor listings (name and id only)
// @route   GET /api/vendor/listings
// @access  Private (Vendor only)
const getVendorListings = async (req, res) => {
  try {
    const vendorId =
      req.vendor?._id || req.user?._id || req.user?.vendorId || req.user?.id;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor not found in request.",
      });
    }

    // Get listings for this vendor with only name and id
    const listings = await Listing.find({ vendor: vendorId })
      .select("_id title")
      .lean();

    // Format the response to include name and id with both languages
    const formattedListings = listings.map((listing) => ({
      id: listing._id,
      name: {
        en: listing.title?.en || listing.title || "Untitled",
        nl: listing.title?.nl || listing.title || "Naamloos",
      },
    }));

    res.json({
      success: true,
      data: formattedListings,
    });
  } catch (err) {
    console.error("Get vendor listings error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

module.exports = {
  toggleListingStatus,
  getVendorListingsOverview,
  getVendorListings,
  createListing,
  updateListing,
  deleteListing,
};
