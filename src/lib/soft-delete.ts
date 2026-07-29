import type { Prisma } from "@prisma/client";

export async function softDelete<T extends { update: (args: any) => Promise<any> }>(
  model: T,
  where: Record<string, unknown>,
): Promise<void> {
  await model.update({
    where,
    data: { deletedAt: new Date() },
  });
}

export async function restoreRecord<T extends { update: (args: any) => Promise<any> }>(
  model: T,
  where: Record<string, unknown>,
): Promise<void> {
  await model.update({
    where,
    data: { deletedAt: null },
  });
}

export const softDeleteMiddleware: Prisma.Middleware = async (params, next) => {
  const softDeleteModels = [
    "matter", "document", "task", "timeEntry", "invoice",
    "calendarEvent", "timelineEvent", "clientMessage",
    "privilegeLogEntry", "depositionTranscript", "transcriptPage",
    "warRoomWitness", "warRoomExhibit", "conflictCheck", "user",
  ];

  if (softDeleteModels.includes(params.model?.toLowerCase() ?? "")) {
    if (params.action === "delete") {
      params.action = "update";
      params.args.data = { deletedAt: new Date() };
    }
    if (params.action === "deleteMany") {
      params.action = "updateMany";
      if (params.args.data) {
        params.args.data.deletedAt = new Date();
      } else {
        params.args.data = { deletedAt: new Date() };
      }
    }
  }

  return next(params);
};
