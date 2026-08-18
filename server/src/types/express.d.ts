export {};

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: number;
        fullName: string;
        email: string;
        role: "admin" | "staff";
      };
    }
  }
}