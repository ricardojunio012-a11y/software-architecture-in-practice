/*
 * C4 model of Morada at the end of chapter 1 (2026).
 * Open it with Structurizr in local mode: docker compose up -d structurizr
 * and go to http://localhost:8080
 */
workspace "Morada" "Community association management SaaS: C4 model for chapter 2" {

    !identifiers hierarchical

    model {
        boardPresident = person "Board president" "Follows charges and delinquency."
        resident = person "Resident" "Gets the notice and pays the dues."
        managementCompany = person "Management company" "Gets the monthly report."

        morada = softwareSystem "Morada" "Calculates and sends the monthly charges." {
            web = container "Web application" "Board and resident screens." "React"
            billing = container "Monthly billing" "Charges, payments and notices." {
                technology "Node.js, PHP, Python or Java"
                app = component "Orchestration" "Calculates, creates, records, notifies."
                calculation = component "Calculation" "Dues, reserve, fee, interest."
                payment = component "Payment methods" "Invoice or card payment code."
                notification = component "Notification" "Email or SMS."
                report = component "Report" "Management company report."
            }
            database = container "Database" "Charges." "PostgreSQL" {
                tags "Database"
            }
        }

        processor = softwareSystem "Payment processor" "Creates invoices (ACH)." {
            tags "External"
        }
        cardProcessor = softwareSystem "Card processor" "Creates card payments." {
            tags "External"
        }
        emailProvider = softwareSystem "Email provider" "Delivers emails." {
            tags "External"
        }
        smsProvider = softwareSystem "SMS provider" "Delivers text messages." {
            tags "External"
        }

        boardPresident -> morada.web "Follows charges"
        resident -> morada.web "Checks and pays"
        morada.web -> morada.database "Reads and writes" "SQL"
        morada.billing.app -> morada.billing.calculation "Calculates"
        morada.billing.app -> morada.billing.payment "Creates the code"
        morada.billing.app -> morada.billing.notification "Notifies"
        morada.billing.app -> morada.billing.report "Records"
        morada.billing.app -> morada.database "Reads and writes" "SQL"
        morada.billing.payment -> processor "Creates invoices" "API"
        morada.billing.payment -> cardProcessor "Creates card payments" "API"
        morada.billing.notification -> emailProvider "Sends emails" "SMTP"
        morada.billing.notification -> smsProvider "Sends text messages" "HTTPS"
        emailProvider -> resident "Delivers the notice"
        smsProvider -> resident "Delivers the notice"
        morada.billing.report -> managementCompany "Sends the report"
    }

    views {
        systemContext morada "Context" "Level 1: context." {
            include *
            autolayout lr
        }
        container morada "Containers" "Level 2: containers." {
            include *
            autolayout lr
        }
        component morada.billing "Components" "Level 3: components." {
            include *
            autolayout lr
        }

        styles {
            element "Person" {
                shape Person
                background #1F4E79
                color #ffffff
            }
            element "Software System" {
                background #1F4E79
                color #ffffff
            }
            element "Container" {
                background #3A6EA5
                color #ffffff
            }
            element "Component" {
                background #DCE8F4
                color #1D2733
            }
            element "External" {
                background #6B7785
                color #ffffff
            }
            element "Database" {
                shape Cylinder
            }
        }
    }
}
