import { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Checkout - AdultAI",
  description: "Subscribe to AdultAI",
}

export default function CheckoutPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Payment Integration Coming Soon</CardTitle>
          <CardDescription>
            We&apos;re setting up adult-friendly payment processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 mb-4">
            Payment processing will be available soon via an adult-friendly provider.
          </p>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Supported Providers:</h3>
            <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
              <li>CCBill (industry standard)</li>
              <li>Segpay</li>
              <li>Epoch</li>
              <li>Cryptocurrency (TEMPT token integration planned)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
