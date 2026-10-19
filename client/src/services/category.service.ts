import { apiGet } from "@/services/api";

/** `genre`: a music genre of the fixed catalogue (false for a non-catalogue row). */
export interface PublicCategory { id:number;name:string;slug:string;description:string|null;icon:string|null;sortOrder:number;genre?:boolean }
export async function fetchCategories(){return (await apiGet<PublicCategory[]>("/categories")).data;}
