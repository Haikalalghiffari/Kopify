import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate } from "@/lib/date";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function MemberProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = (session.user as any).id;
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { member: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profil Saya</h1>
        <p className="text-sm text-gray-500 mt-1">Kelola informasi akun dan kata sandi Anda</p>
      </div>

      {user.member && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informasi Keanggotaan</CardTitle>
            <CardDescription>Data resmi Anda di koperasi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Nomor Anggota</span>
              <span className="font-semibold text-primary">{user.member.memberNo}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Status Keanggotaan</span>
              <Badge variant={user.member.status === "AKTIF" ? "default" : "secondary"}>
                {user.member.status}
              </Badge>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Tanggal Bergabung</span>
              <span>{formatDate(user.member.joinedAt)}</span>
            </div>
            {user.member.phone && (
              <div className="flex justify-between py-1 border-b">
                <span className="text-gray-500">No. Handphone</span>
                <span>{user.member.phone}</span>
              </div>
            )}
            {user.member.address && (
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Alamat</span>
                <span className="text-right max-w-xs">{user.member.address}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pengaturan Akun & Password</CardTitle>
          <CardDescription>Ubah nama tampilan atau perbarui kata sandi Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initialName={user.member?.name || user.username}
            email={user.email}
          />
        </CardContent>
      </Card>
    </div>
  );
}
