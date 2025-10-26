import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameGoogleToGmail1730000000000 implements MigrationInterface {
  name = 'RenameGoogleToGmail1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Migration: Renaming appName from "google" to "gmail"');

    // Show existing records before migration
    const beforeRecords = await queryRunner.query(
      `SELECT id, "appName" FROM user_app WHERE "appName" = 'google'`,
    );
    console.log(
      `Found ${beforeRecords.length} record(s) with appName = 'google'`,
    );

    if (beforeRecords.length > 0) {
      // Perform the migration
      await queryRunner.query(
        `UPDATE user_app SET "appName" = 'gmail' WHERE "appName" = 'google'`,
      );

      console.log(`Updated ${beforeRecords.length} record(s) successfully`);

      // Verify the migration
      const afterRecords = await queryRunner.query(
        `SELECT id, "appName" FROM user_app WHERE "appName" = 'gmail'`,
      );
      console.log(
        `Verification: ${afterRecords.length} record(s) now have appName = 'gmail'`,
      );
    } else {
      console.log(
        'No records found with appName = "google". Migration not needed.',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Reverting: Renaming appName from "gmail" back to "google"');

    // Revert the migration
    await queryRunner.query(
      `UPDATE user_app SET "appName" = 'google' WHERE "appName" = 'gmail'`,
    );

    console.log('Reverted successfully');
  }
}
