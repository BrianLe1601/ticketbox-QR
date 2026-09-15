import { apiGet } from "@/services/api";

export interface PublicCategory { id:number;name:string;slug:string;description:string|null;icon:string|null;sortOrder:number }
export async function fetchCategories(){return (await apiGet<PublicCategory[]>("/categories")).data;}
