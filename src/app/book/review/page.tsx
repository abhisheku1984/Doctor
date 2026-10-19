import { redirect } from "next/navigation";

/** The review step is part of the guided wizard at /book (step 4). */
export default function ReviewPage() {
  redirect("/book");
}
