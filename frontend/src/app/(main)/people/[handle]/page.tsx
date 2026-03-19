import { redirect } from 'next/navigation';

export default function PersonRedirect({ params }: { params: { handle: string } }) {
    redirect(`/thanh-vien/${params.handle}`);
}
