# Deploying ACBC Construction Site to AWS S3

This guide will help you upload the static HTML site to an S3 bucket and configure it for static website hosting.

## Prerequisites

- AWS CLI installed and configured
- AWS account with appropriate permissions
- Domain name ready to configure

## Step 1: Create S3 Bucket

```bash
# Replace 'acbc-construccion' with your desired bucket name (must be globally unique)
BUCKET_NAME="acbc-construccion"
REGION="us-east-1"  # Change to your preferred region

# Create the bucket
aws s3 mb s3://$BUCKET_NAME --region $REGION
```

## Step 2: Configure Bucket for Static Website Hosting

### Option A: Using AWS Console (Recommended for first-time setup)

1. Go to **AWS S3 Console**: https://console.aws.amazon.com/s3/
2. Click on your bucket name (e.g., `acbc-construccion`)
3. Click on the **"Properties"** tab (at the top)
4. Scroll down to find **"Static website hosting"** section
5. Click **"Edit"** button
6. Select **"Enable"** static website hosting
7. Configure:
   - **Index document**: `index.html`
   - **Error document**: `index.html` (or leave blank)
8. Click **"Save changes"**
9. After saving, you'll see the **"Bucket website endpoint"** URL at the top of the section - this is your website URL!

### Option B: Using AWS CLI

```bash
# Enable static website hosting
aws s3 website s3://$BUCKET_NAME \
    --index-document index.html \
    --error-document index.html
```

**Note**: The static website hosting option is located in the **Properties** tab of your S3 bucket in the AWS Console, NOT in the Permissions or other tabs.

## Step 3: Set Bucket Policy for Public Read Access

Create a file `bucket-policy.json`:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::BUCKET_NAME/*"
        }
    ]
}
```

Replace `BUCKET_NAME` with your actual bucket name, then apply:

```bash
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://bucket-policy.json
```

## Step 4: Block Public Access Settings

You need to allow public access for the website to work:

```bash
aws s3api put-public-access-block \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

## Step 5: Upload Files to S3

From the `sitio_construccion` directory:

```bash
# Upload all files with public read access
aws s3 sync . s3://$BUCKET_NAME \
    --exclude "*.md" \
    --exclude "DEPLOY_S3.md" \
    --exclude "bucket-policy.json" \
    --acl public-read
```

Or upload files individually:

```bash
aws s3 cp index.html s3://$BUCKET_NAME/index.html --acl public-read
aws s3 cp styles.css s3://$BUCKET_NAME/styles.css --acl public-read
aws s3 cp acbc_logo_transparent.png s3://$BUCKET_NAME/acbc_logo_transparent.png --acl public-read
aws s3 cp image_1.PNG s3://$BUCKET_NAME/image_1.PNG --acl public-read
aws s3 cp image_2.png s3://$BUCKET_NAME/image_2.png --acl public-read
```

## Step 6: Get Your Website URL

After uploading, your site will be available at:

```
http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com
```

Or:

```
http://$BUCKET_NAME.s3-website.$REGION.amazonaws.com
```

Get the exact URL with:

```bash
aws s3api get-bucket-website --bucket $BUCKET_NAME
```

## Step 7: Point Your Domain to S3


### Option A: Using S3 Website Endpoint

**For WWW Subdomain (www.academiablockchain.com):**
1. Go to your domain registrar DNS settings
2. Create a **CNAME record**:
   - **Name/Host**: `www`
   - **Value/Target**: `$BUCKET_NAME.s3-website-$REGION.amazonaws.com` (your full S3 website endpoint)
   - **TTL**: Automatic or 300

**For Root Domain (academiablockchain.com) - Namecheap Users:**

**⚠️ IMPORTANT**: You **CANNOT** use a CNAME record for the root domain (`@`). DNS protocol doesn't allow CNAME at the apex.

**Namecheap Solution - Use URL Redirect:**
1. In Namecheap DNS settings, find **"Advanced DNS"** tab
2. For the root domain (`@`), use **"URL Redirect Record"** (not CNAME):
   - **Type**: URL Redirect
   - **Host**: `@`
   - **Value**: `http://www.academiablockchain.com` (redirects to www)
   - **Redirect Type**: 301 (Permanent) or 302 (Temporary)
3. This will redirect `academiablockchain.com` → `www.academiablockchain.com`

**Alternative for Root Domain - Use A Record (if supported):**
Some registrars support ALIAS/ANAME records that work like A records but point to hostnames:
- Check if Namecheap supports "ALIAS" or "ANAME" records
- If yes, use that instead of CNAME for `@`
- Point it to: `$BUCKET_NAME.s3-website-$REGION.amazonaws.com`

**Note**: For direct root domain support without redirect, you'll need CloudFront (Option B) or Route 53 (Option C).

### Option B: Using CloudFront (Recommended for Production)

1. Create a CloudFront distribution:
   ```bash
   # This requires CloudFront setup via AWS Console or more complex CLI commands
   # Recommended: Use AWS Console for CloudFront setup
   ```

2. In CloudFront Console:
   - Origin Domain: Select your S3 bucket website endpoint
   - Viewer Protocol Policy: Redirect HTTP to HTTPS (recommended)
   - Default Root Object: `index.html`
   - Create distribution

3. Point your domain to CloudFront:
   - Create CNAME or A record pointing to CloudFront distribution domain

### Option C: Using Route 53 Alias (Best for Root Domain)

If using Route 53:

1. Create an alias record:
   - **Record name**: Leave blank for root domain, or `www` for subdomain
   - **Record type**: A (or AAAA for IPv6)
   - **Alias**: Yes
   - **Alias target**: Select your S3 bucket website endpoint
   - **Routing policy**: Simple

## Step 8: Enable HTTPS (Optional but Recommended)

For HTTPS, you'll need:
1. Request an SSL certificate via AWS Certificate Manager (ACM)
2. Use CloudFront with the certificate
3. Configure CloudFront to use HTTPS

## Verification

After setup, verify:
1. S3 bucket website URL works
2. Domain DNS has propagated (can take up to 48 hours)
3. All images and CSS load correctly
4. Social media links work

## Troubleshooting

### 403 Forbidden Error
- Check bucket policy allows public read
- Verify public access block settings
- Ensure files have `public-read` ACL

### Images Not Loading
- Verify all image files are uploaded
- Check file paths in HTML match S3 file names (case-sensitive)
- Ensure images have `public-read` ACL

### Domain Not Resolving
- Check DNS propagation: `nslookup yourdomain.com`
- Verify CNAME/A record is correct
- Wait for DNS propagation (up to 48 hours)

## Quick Reference Commands

```bash
# Set variables
BUCKET_NAME="acbc-construccion"
REGION="us-east-1"

# Create and configure bucket
aws s3 mb s3://$BUCKET_NAME --region $REGION
aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html

# Upload files
aws s3 sync . s3://$BUCKET_NAME --exclude "*.md" --acl public-read

# Get website URL
echo "http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
```

