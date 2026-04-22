const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const awsRegion = process.env.AWS_REGION;
const awsBucketName = process.env.AWS_S3_BUCKET;

const ensureAwsConfig = () => {
  if (!awsRegion || !awsBucketName || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      "Missing AWS S3 configuration. Set AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY."
    );
  }
};

const s3Client = new S3Client({
  region: awsRegion,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const getExtensionFromMime = (mimeType = "") => {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
};

const uploadBufferToS3 = async ({ buffer, mimeType, keyPrefix = "products" }) => {
  ensureAwsConfig();
  const extension = getExtensionFromMime(mimeType);
  const key = `${keyPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: awsBucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return `https://${awsBucketName}.s3.${awsRegion}.amazonaws.com/${key}`;
};

module.exports = {
  uploadBufferToS3,
};
