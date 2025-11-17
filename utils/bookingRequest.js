import mongoose from "mongoose";
import Listing from "../models/Listing";
import Vendor from "../models/Vendor";
import User from "../models/User";
import Settings from "../models/Settings";
import {
  checkAvailability,
  checkListingStock,
  getListingPaymentPolicy,
} from "../utils/bookingUtils";
import { toMultilingualText } from "../utils/textUtils";
import notificationController from "../controllers/notificationController";
import BookingRequest from "../models/Booking";

export const createBookingRequest = async (data) => {
  const {
    userId,
    listingId,
    vendorId,
    startDate,
    endDate,
    startTime,
    endTime,
    eventLocation,
    eventType,
    guestCount,
    distanceKm,
    specialRequests,
  } = data;

  // Calculate duration and multi-day details early to determine validation
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const diffTime = Math.abs(endDateObj - startDateObj);
  let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  let isMultiDay = diffDays > 1;

  // Validate required fields
  if (!listingId || !vendorId || !startDate || !endDate || !eventLocation) {
    throw new Error("Missing required fields");
  }
  if (!isMultiDay && (!startTime || !endTime)) {
    throw new Error(
      "Start time and end time are required for single-day bookings."
    );
  }

  // Check if listing exists and is active
  const listing = await Listing.findOne({
    _id: listingId,
    isActive: true,
    status: "active",
  })
    .populate("vendor")
    .populate("category", "name")
    .populate("subCategory", "name");

  if (!listing) {
    throw new Error("Listing not found or not available");
  }

  // Check stock before proceeding (default required quantity = 1, allow override from body.quantity)
  const requestedQty = 1;
  const stock = await checkListingStock(listingId, requestedQty);
  if (!stock.ok) {
    throw new Error(stock.message);
  }

  // If listing charges per km, require distanceKm in request details
  if (
    typeof distanceKm === "undefined" ||
    isNaN(Number(distanceKm)) ||
    Number(distanceKm) <= 0
  ) {
    throw new Error(
      "distanceKm is required and must be a positive number for this listing."
    );
  }

  // Verify vendor matches (guard for missing vendor)
  if (
    !listing.vendor ||
    !listing.vendor._id ||
    listing.vendor._id.toString() !== vendorId
  ) {
    throw new Error("Vendor mismatch");
  }

  // Check availability for all days in the range, including time slots for single-day bookings
  const isAvailable = await checkAvailability(
    listingId,
    new Date(startDate),
    new Date(endDate),
    null, // excludeBookingId
    startTime, // pass startTime for time slot validation
    endTime // pass endTime for time slot validation
  );
  if (!isAvailable) {
    throw new Error(
      "Selected dates/times are not available. The time slot may be outside available hours or already booked."
    );
  }

  // Calculate hours per day and total hours depending on presence of times and multi-day
  let dailyHours = 0;
  let totalHours = 0;

  const calculateHours = (startTime, endTime) => {
    const startTimeObj = new Date(`2000-01-01 ${startTime}`);
    const endTimeObj = new Date(`2000-01-01 ${endTime}`);
    let diffHours = (endTimeObj - startTimeObj) / (1000 * 60 * 60);
    if (diffHours < 0) diffHours += 24; // Handle overnight
    return Math.max(diffHours, 0);
  };

  if (startTime && endTime) {
    // We have times; compute daily hours and total hours across days
    dailyHours = calculateHours(startTime, endTime);
    totalHours = isMultiDay ? dailyHours * diffDays : dailyHours;
  } else {
    // No times provided. For per-hour pricing assume full days = 24 hours per day
    dailyHours = isMultiDay ? 24 : 0; // if single-day and no times, leave dailyHours 0 but totalHours as 24
    totalHours = diffDays * 24;
  }

  // Fetch platform fee from Settings
  const settings = await Settings.findOne();
  let platformFeePercent = 0.015; // default 1.5%

  if (settings && typeof settings.bookingItemPlatformFee === "number") {
    platformFeePercent = settings.bookingItemPlatformFee;
  }

  // Calculate pricing using utility
  const pricingResult = calculateFullBookingPrice(listing, {
    startDate,
    endDate,
    startTime,
    endTime,
    distanceKm,
    total,
  });

  if (pricingResult && pricingResult.error) {
    throw new Error(pricingResult.error);
  }

  const bookingPrice = pricingResult.bookingPrice;
  const platformFee = Math.round(bookingPrice * platformFeePercent) / 100;
  const extratimeCost = pricingResult.extratimeCost;
  const securityFee = pricingResult.securityFee;
  const kmCharge = pricingResult.kmCharge;
  const subtotal = bookingPrice + extratimeCost + securityFee + kmCharge;
  const totalPrice = subtotal + platformFee;
  dailyHours = pricingResult.dailyHours;
  totalHours = pricingResult.totalHours;
  diffDays = pricingResult.diffDays;
  isMultiDay = pricingResult.isMultiDay;

  // Calculate platform fee as percentage of booking price

  // Transform eventType and specialRequests to multilingual format if they are strings
  let processedEventType = eventType;
  let processedSpecialRequests = specialRequests;

  // If eventType is a string, convert to multilingual object
  if (typeof eventType === "string") {
    processedEventType = {
      en: eventType,
      nl: eventType, // Use same value for Dutch, can be translated later
    };
  }

  // If specialRequests is a string, convert to multilingual object
  if (typeof specialRequests === "string") {
    processedSpecialRequests = {
      en: specialRequests,
      nl: specialRequests, // Use same value for Dutch, can be translated later
    };
  }
  // Create booking request with multi-day support

  console.log(listing, "listinglistinglistinglisting");
  const result = getDayCount(startDate, endDate);
  // console.log(result, "RESSASDASDADASD");
  // return
  const bookingRequest = new BookingRequest({
    userId,
    vendorId,
    listingId,
    listingDetails: {
      title: listing.title,
      subtitle: listing.subtitle,
      description: listing.description,
      featuredImage:
        listing.images && listing.images.length > 0 ? listing.images[0] : "",
      images: listing.images || [],
      pricing: {
        type: listing.pricing.type,
        amount: listing.pricing.amount,
        extratimeCost: listing.pricing.extratimeCost || 0,
        securityFee: listing.pricing.securityFee || 0,
        pricePerKm: listing.pricing.pricePerKm || 0,
        days: result,
      },
      category: listing.category
        ? {
            _id: listing.category._id,
            name: listing.category.name,
          }
        : "",
      subCategory: listing.subCategory
        ? {
            _id: listing.subCategory._id,
            name: listing.subCategory.name,
          }
        : "",
      serviceDetails: {
        serviceType: listing.serviceDetails?.serviceType,
      },
      location: {
        fullAddress: listing.location?.fullAddress,
        coordinates: {
          latitude: listing.location?.coordinates?.latitude,
          longitude: listing.location?.coordinates?.longitude,
        },
      },
      contact: {
        phone: listing.contact?.phone,
        email: listing.contact?.email,
        website: listing.contact?.website,
      },
      features: listing.features || [],
      rating: {
        average: listing.rating?.average || 0,
        totalReviews: listing.rating?.totalReviews || 0,
      },
    },
    details: {
      startDate,
      endDate,
      ...(isMultiDay ? {} : { startTime, endTime }),
      duration: {
        hours: dailyHours,
        days: diffDays,
        totalHours: totalHours,
        isMultiDay: isMultiDay,
      },
      eventLocation,
      eventType: processedEventType,
      guestCount,
      specialRequests: processedSpecialRequests,
    },
    pricing: {
      type: listing.pricing.type,
      amount: listing.pricing.amount,
      extratimeCost: extratimeCost,
      securityPrice: securityFee,
      extraCharges: 0,
      subtotal: subtotal,
      pricePerKm: listing.pricing.pricePerKm || 0,
      distanceKm: Number(distanceKm) || 0,
      kmCharge: kmCharge,
      bookingPrice: bookingPrice,
      extratimeCostApplied: extratimeCost,
      totalPrice: totalPrice,
      platformFee: platformFee,
      // Optionally add dailyRate for multi-day
      ...(isMultiDay && {
        dailyRate: Math.round(bookingPrice / diffDays),
      }),
    },
    platformFee,
  });

  await bookingRequest.save();

  // Notify vendor of new booking request
  try {
    const vendor = await Vendor.findById(bookingRequest.vendorId);
    const client = await User.findById(bookingRequest.userId).select(
      "firstName lastName"
    );

    if (vendor && vendor.userId) {
      const clientName = client
        ? `${client.firstName} ${client.lastName}`
        : "A client";
      const listingTitle = listing.title || "your listing";
      const bookingDates = `${startDate}${
        endDate !== startDate ? ` to ${endDate}` : ""
      }`;

      await notificationController.createNotification({
        user: vendor.userId, // vendor's user account receives notification
        bookingId: bookingRequest._id,
        message: `New booking request from ${clientName} for "${listingTitle}" on ${bookingDates}. Tracking ID: ${bookingRequest.trackingId}`,
      });
    }
  } catch (e) {
    console.error("Failed to create vendor notification for new booking:", e);
  }
  // Populate the response (listing details are now stored directly in listingDetails field)
  await bookingRequest.populate([
    { path: "userId", select: "firstName lastName email contactNumber" },
    { path: "vendorId", select: "businessName businessEmail businessPhone" },
  ]);

  // Determine subcategory payment policy (escrow/upfront)
  const policy = await getListingPaymentPolicy(listing);
  const upfrontAmount =
    policy.escrowEnabled && policy.upfrontFeePercent > 0
      ? Math.round(((totalPrice * policy.upfrontFeePercent) / 100) * 100) / 100
      : 0;
  const remainingAmount = Math.max(
    Math.round((totalPrice - upfrontAmount) * 100) / 100,
    0
  );

  return bookingRequest;
};

/**
 * Calculate full booking pricing details (booking price, fees, km charge, totals)
 * @param {Object} listing - Listing document
 * @param {Object} opts - { startDate, endDate, startTime, endTime, numberOfEvents, distanceKm }
 * @returns {Object} - pricing breakdown or { error, status }
 */
const calculateFullBookingPrice = (listing, opts = {}) => {
  try {
    const {
      startDate,
      endDate,
      startTime,
      endTime,
      numberOfEvents,
      distanceKm,
      totallllllllllllllllllll,
      securityFeeeeeeeeeeee,
    } = opts;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // include both days
    const isMultiDay = diffDays > 1;

    // calculate hours
    const calculateHours = (s, e) => {
      const sObj = new Date(`2000-01-01 ${s}`);
      const eObj = new Date(`2000-01-01 ${e}`);
      let diffHours = (eObj - sObj) / (1000 * 60 * 60);
      if (diffHours < 0) diffHours += 24;
      return Math.max(diffHours, 0);
    };

    let dailyHours = 0;
    let totalHours = 0;
    if (startTime && endTime) {
      dailyHours = calculateHours(startTime, endTime);
      totalHours = isMultiDay ? dailyHours * diffDays : dailyHours;
    } else {
      dailyHours = isMultiDay ? 24 : 0;
      totalHours = diffDays * 24;
    }

    const extratimeCost = listing.pricing.extratimeCost || 0;
    const securityFee = listing.pricing.securityFee || 0;

    // validate pricing amount
    if (!listing.pricing.type || typeof listing.pricing.amount !== "number") {
      return { error: "Listing pricing information is invalid.", status: 400 };
    }

    const pricingType = (listing.pricing.type || "").toString().toLowerCase();
    const eventsCount = Number(numberOfEvents) > 0 ? Number(numberOfEvents) : 1;
    console.log("Pricing Type:", pricingType);
    let bookingPrice = 0;
    if (
      pricingType === "PerHour" ||
      pricingType === "hourly" ||
      pricingType === "perhour" ||
      pricingType === "per hour"
    ) {
      bookingPrice = listing.pricing.amount * totalHours;
    } else if (
      pricingType === "PerDay" ||
      pricingType === "daily" ||
      pricingType === "perday" ||
      pricingType === "per day"
    ) {
      bookingPrice = listing.pricing.amount * diffDays;
    } else if (
      pricingType === "PerEvent" ||
      pricingType === "event" ||
      pricingType === "perevent" ||
      pricingType === "per event"
    ) {
      bookingPrice = listing.pricing.amount * eventsCount;
    } else if (
      pricingType === "fixed" ||
      pricingType === "fixedprice" ||
      pricingType === "one-time" ||
      pricingType === "fixed price" ||
      pricingType === "one time"
    ) {
      bookingPrice = listing.pricing.amount;
    } else {
      return { error: "Unsupported pricing type.", status: 400 };
    }

    // km charge
    let kmCharge = 0;
    if (
      typeof listing.pricing.pricePerKm === "number" &&
      Number(distanceKm) > 0
    ) {
      kmCharge =
        Math.round(listing.pricing.pricePerKm * Number(distanceKm) * 100) / 100;
    }

    console.log("Booking Price Calculation:", {
      bookingPrice,
      extratimeCost,
      securityFee,
      kmCharge,
    });

    // subtotal, system fee and total
    const subtotal = bookingPrice + extratimeCost + securityFee + kmCharge;
    const systemFeePercent = 0.02;
    const systemFee = Math.round(subtotal * systemFeePercent * 100) / 100;
    const totalPrice = Math.round((subtotal + systemFee) * 100) / 100;

    const result = {
      bookingPrice,
      extratimeCost,
      securityFee,
      kmCharge,
      subtotal,
      systemFee,
      systemFeePercent,
      totalPrice,
      dailyHours,
      totalHours,
      diffDays,
      isMultiDay,
      dailyRate: isMultiDay ? Math.round(bookingPrice / diffDays) : null,
    };

    return result;
  } catch (e) {
    console.error("Error calculating booking price:", e);
    return { error: "Failed to calculate booking price", status: 500 };
  }
};
