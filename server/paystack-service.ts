import axios from 'axios';
import crypto from 'crypto';

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
      throw new Error('PAYSTACK_SECRET_KEY environment variable must be set');
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
    reference?: string,
    callbackUrl?: string,
    metadata?: Record<string, any>
  ) {
    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/transaction/initialize`,
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          email,
          amount,
          reference: reference || this.generateReference(),
          callback_url: callbackUrl,
          metadata
        }
      });
      
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
      number: string,
      cvv: string,
      expiryMonth: string,
      expiryYear: string
    },
    metadata?: Record<string, any>
  ) {
    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/charge`,
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          email,
          amount,
          card: {
            number: cardDetails.number,
            cvv: cardDetails.cvv,
            expiry_month: cardDetails.expiryMonth,
            expiry_year: cardDetails.expiryYear
          },
          metadata
        }
      });
      
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
      const response = await axios({
        method: 'get',
        url: `${this.baseUrl}/transaction/verify/${reference}`,
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Paystack transaction verification error:', error.response?.data || error.message);
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
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/customer`,
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          email,
          first_name: firstName,
          last_name: lastName,
          phone
        }
      });
      
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
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/plan`,
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          name,
          amount,
          interval,
          description
        }
      });
      
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
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/subscription`,
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          customer: customerEmail,
          plan: planCode,
          authorization,
          start_date: startDate
        }
      });
      
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
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/subscription/disable`,
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          code: subscriptionCode,
          token: emailToken
        }
      });
      
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
    return `VPN_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
}

export const paystackService = new PaystackService();