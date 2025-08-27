import { z } from 'zod';

// Define schemas for tool parameters
const flightSearchSchema = z.object({
  from: z.string().min(1, "Departure city is required"),
  to: z.string().min(1, "Destination city is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
});

const hotelSearchSchema = z.object({
  city: z.string().min(1, "City is required"),
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-in date must be YYYY-MM-DD format"),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-out date must be YYYY-MM-DD format")
});

export const searchFlightsTool = {
  name: "search_flights",
  description: "Search for flights between two cities",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string", description: "Departure city" },
      to: { type: "string", description: "Destination city" },
      date: { type: "string", description: "Departure date YYYY-MM-DD" }
    },
    required: ["from", "to", "date"]
  },
  function: async (params) => {
    // Validate parameters
    const validation = flightSearchSchema.safeParse(params);
    if (!validation.success) {
      return JSON.stringify({
        error: validation.error.errors[0].message
      });
    }

    const { from, to, date } = validation.data;
    console.log(`Searching flights: ${from} → ${to} on ${date}`);
    
    // Mock flight data
    return JSON.stringify({
      flights: [
        {
          airline: "CheapoAir Express",
          price: "$299",
          departure: `${date} 08:00`,
          arrival: `${date} 11:00`,
          flightNumber: "CA123"
        },
        {
          airline: "Budget Airways",
          price: "$249",
          departure: `${date} 14:00`,
          arrival: `${date} 17:00`,
          flightNumber: "BA456"
        }
      ]
    });
  }
};

export const searchHotelsTool = {
  name: "search_hotels",
  description: "Search for hotels in a city",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "City to search hotels in" },
      checkin: { type: "string", description: "Check-in date YYYY-MM-DD" },
      checkout: { type: "string", description: "Check-out date YYYY-MM-DD" }
    },
    required: ["city", "checkin", "checkout"]
  },
  function: async (params) => {
    // Validate parameters
    const validation = hotelSearchSchema.safeParse(params);
    if (!validation.success) {
      return JSON.stringify({
        error: validation.error.errors[0].message
      });
    }

    const { city, checkin, checkout } = validation.data;
    console.log(`Searching hotels: ${city} from ${checkin} to ${checkout}`);
    
    // Mock hotel data
    return JSON.stringify({
      hotels: [
        {
          name: "CheapoAir Plaza Hotel",
          price: "$89/night",
          rating: 4.2,
          location: "Downtown"
        },
        {
          name: "Budget Inn Express",
          price: "$69/night",
          rating: 3.8,
          location: "Airport Area"
        }
      ]
    });
  }
};