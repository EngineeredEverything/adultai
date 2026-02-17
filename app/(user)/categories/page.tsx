import { currentUser } from "@/utils/auth";
import { redirect } from "next/navigation";
import CategoriesClient from "./_components/CategoriesClient";

export default async function AllCategoriesPage() {

    // const user = await currentUser();
    // if (!user) redirect("/auth/login");
    return <CategoriesClient />;

}
