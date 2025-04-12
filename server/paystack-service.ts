import axios from 'axios';

/**
 * Paystack Payment Service
 * 
 * This service provides an interface to interact with the Paystack API
 * for processing payments, subscriptions, and verifying transactions.
 */
class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;
  
  constructor() {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY is not defined in environment variables');
    }
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
  }
  
  /**
   * Create a Paystack payment request for a one-time payment
   * 
   * @param email - Customer's email address
   * @param amount - Amount in kobo (e.g., 10000 for ₦100.00)
   * @param reference - Unique transaction reference
   * @param callbackUrl - URL to redirect to after payment
   * @param metadata - Additional information about the transaction
   * @returns Payment initialization response with authorization URL
   */
  async initializeTransaction(
    email: string,
    amount: number,
    reference: string,
    callbackUrl?: string,
    metadata?: Record<string, any>
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: Math.round(amount * 100), // Convert to kobo/cents
          reference,
          callback_url: callbackUrl,
          metadata
        },
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Paystack transaction initialization error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Create a direct charge transaction using card details
   * 
   * @param email - Customer's email address
   * @param amount - Amount in kobo (e.g., 10000 for ₦100.00)
   * @param cardDetails - Card details for charging
   * @param metadata - Additional information about the transaction
   * @returns Charge response
   */
  async chargeCard(
    email: string,
    amount: number,
    cardDetails: {
      number: string;
      cvv: string;
      expiryMonth: string;
      expiryYear: string;
    },
    metadata?: Record<string, any>
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/charge`,
        {
          email,
          amount: Math.round(amount * 100), // Convert to kobo/cents
          card: {
            number: cardDetails.number,
            cvv: cardDetails.cvv,
            expiry_month: cardDetails.expiryMonth,
            expiry_year: cardDetails.expiryYear
          },
          metadata
        },
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Paystack card charge error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Verify a transaction by reference
   * 
   * @param reference - Transaction reference to verify
   * @returns Verification response
   */
  async verifyTransaction(reference: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Paystack verification error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Create a customer in Paystack
   * 
   * @param email - Customer's email address
   * @param firstName - Customer's first name
   * @param lastName - Customer's last name
   * @param phone - Customer's phone number
   * @returns Created customer data
   */
  async createCustomer(
    email: string,
    firstName?: string,
    lastName?: string,
    phone?: string
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/customer`,
        {
          email,
          first_name: firstName,
          last_name: lastName,
          phone
        },
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Paystack customer creation error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Create a subscription plan in Paystack
   * 
   * @param name - Plan name
   * @param amount - Amount in kobo (e.g., 10000 for ₦100.00)
   * @param interval - Billing interval (daily, weekly, monthly, quarterly, biannually, annually)
   * @param description - Plan description
   * @returns Created plan data
   */
  async createPlan(
    name: string,
    amount: number,
    interval: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'annually',
    description?: string
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/plan`,
        {
          name,
          amount: Math.round(amount * 100), // Convert to kobo/cents
          interval,
          description
        },
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Paystack plan creation error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Create a subscription for a customer
   * 
   * @param customerEmail - Customer email address
   * @param planCode - Plan code from createPlan response
   * @param authorization - Authorization code from a previous transaction
   * @param startDate - Date to start the subscription (ISO format)
   * @returns Created subscription data
   */
  async createSubscription(
    customerEmail: string,
    planCode: string,
    authorization?: string,
    startDate?: string
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/subscription`,
        {
          customer: customerEmail,
          plan: planCode,
          authorization,
          start_date: startDate
        },
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Paystack subscription creation error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Cancel a subscription
   * 
   * @param subscriptionCode - Subscription code to cancel
   * @param emailToken - Email token sent to the user
   * @returns Cancellation response
   */
  async cancelSubscription(subscriptionCode: string, emailToken?: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/subscription/disable`,
        {
          code: subscriptionCode,
          token: emailToken
        },
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Paystack subscription cancellation error:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Generate a unique transaction reference
   * @returns A unique transaction reference string
   */
  generateReference(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `vpn_${timestamp}_${random}`;
  }
}

// Export a singleton instance
export const paystackService = new PaystackService();