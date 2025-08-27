import { z } from 'zod';

const updateContextSchema = z.object({
  destination: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  duration: z.number().positive().optional()
});

export function createContextUpdateTool(context:any) {
  return {
    name: "update_trip_context",
    description: "Update the trip planning context",
    parameters: {
      type: "object",
      properties: {
        destination: { type: "string", description: "Trip destination" },
        start_date: { type: "string", description: "Start date YYYY-MM-DD" },
        end_date: { type: "string", description: "End date YYYY-MM-DD" },
        duration: { type: "number", description: "Trip duration in days" }
      }
    },
    function: async (params:any) => {
      const validation = updateContextSchema.safeParse(params);
      if (!validation.success) {
        return `Error: ${validation.error.errors[0].message}`;
      }

      const data = validation.data;
      
      if (data.destination) {
        context.update({ destination: data.destination });
      }
      
      if (data.start_date && data.end_date) {
        context.update({
          dates: {
            start: data.start_date,
            end: data.end_date,
            duration: data.duration || 5
          }
        });
      }
      
      return "Context updated successfully";
    }
  };
}