// tools.ts
import { tool } from '@openai/agents';
import { z } from 'zod';

// Flights (use for intent: flight_search or trip_plan)
export const search_flights_cheapoair = tool({
  name: 'search_flights_cheapoair',
  description:
    "Return flight options via CheapoAir. Call when intent is 'flight_search' or 'trip_plan'.",
  parameters: z.object({
    from: z.string().describe('Origin (IATA or city)'),
    to: z.string().describe('Destination (IATA or city)'),
    depart: z.string().describe('YYYY-MM-DD'),
    ret: z.string().describe('YYYY-MM-DD (optional)').optional().nullable(),
    adults: z.number().int().positive().default(1).describe('Passenger count')
  }),
  async execute({ from, to, depart, ret, adults }) {
    // args are fully typed from Zod 👆
    return {
      currency: 'INR',
      results: [
        { id: 'AF225', carrier: 'Air France', from, to, depart: `${depart}T09:25+05:30`,
          arrive: `${depart}T18:45+01:00`, stops: 1, duration: '12h 50m', fare: 58900 },
        { id: 'LH761', carrier: 'Lufthansa', from, to, depart: `${depart}T02:50+05:30`,
          arrive: `${depart}T12:35+01:00`, stops: 1, duration: '12h 15m', fare: 61250 }
      ],
      passengers: adults ?? 1,
      ret: ret ?? null,
      disclaimer: 'Static demo data — not live pricing.'
    };
  }
});

// Hotels (use for intent: hotel_search or trip_plan)
export const search_hotels_cheapoair = tool({
  name: 'search_hotels_cheapoair',
  description:
    "Return hotel options via CheapoAir. Call when intent is 'hotel_search' or 'trip_plan'.",
  parameters: z.object({
    city: z.string(),
    check_in: z.string().describe('YYYY-MM-DD'),
    check_out: z.string().describe('YYYY-MM-DD'),
    rooms: z.number().int().positive().default(1),
    guests: z.number().int().positive().default(2)
  }),
  async execute({ city, check_in, check_out, rooms, guests }) {
    return {
      currency: 'INR',
      results: [
        { id: 'HTL-1', name: 'Riviera Central', city, area: 'City Center',
          rating: 4.4, pricePerNight: 9800, freeCancellation: true },
        { id: 'HTL-2', name: 'Grand Parkview', city, area: 'Near Museum District',
          rating: 4.2, pricePerNight: 8200, freeCancellation: false }
      ],
      check_in, check_out, rooms, guests,
      disclaimer: 'Static demo data — not live availability.'
    };
  }
});

// Cars (use for intent: car_search)
export const search_cars_cheapoair = tool({
  name: 'search_cars_cheapoair',
  description: "Return car rental options via CheapoAir. Call when intent is 'car_search'.",
  parameters: z.object({
    city: z.string(),
    pickup_date: z.string().describe('YYYY-MM-DD'),
    dropoff_date: z.string().describe('YYYY-MM-DD')
  }),
  async execute({ city, pickup_date, dropoff_date }) {
    return {
      currency: 'INR',
      results: [
        { id: 'CAR-ECON', brand: 'Toyota', model: 'Yaris', class: 'Economy', pricePerDay: 2100 },
        { id: 'CAR-SUV', brand: 'Hyundai', model: 'Creta', class: 'SUV', pricePerDay: 3900 }
      ],
      city, pickup_date, dropoff_date,
      disclaimer: 'Static demo data — not live inventory.'
    };
  }
});
